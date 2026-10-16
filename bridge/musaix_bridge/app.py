"""FastAPI OSC Bridge.

    Musaix backend ──HTTP──▶ /commands ──queue (rate-limited)──▶ UDP ──▶ MusaixPROOSC ──▶ Live 12
                     ◀── result / snapshot ◀── feedback listener (UDP 9000) ◀──────────────┘

Safety model (from the Musaix doctrine):
* every command is schema-validated before it is queued;
* one asyncio queue, drained at ``BRIDGE_RATE_HZ`` (default 8 Hz), so a burst of
  tool calls can't flood Live;
* ``panic.stop_all`` jumps the queue: pending commands are dropped and panic is
  sent immediately;
* bearer-style shared token on every route except ``/health``.
"""

from __future__ import annotations

import asyncio
import hmac
import os
import time
import uuid
from collections import deque
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, ValidationError

from .commands import parse_command
from .transport import Transport, UdpTransport, decode_feedback

PANIC = "panic.stop_all"
SNAPSHOT = "state.snapshot"


@dataclass
class Settings:
    token: str | None = field(default_factory=lambda: os.getenv("OSC_BRIDGE_TOKEN") or None)
    live_host: str = field(default_factory=lambda: os.getenv("BRIDGE_LIVE_HOST", "127.0.0.1"))
    live_port: int = field(default_factory=lambda: int(os.getenv("BRIDGE_LIVE_PORT", "9002")))
    feedback_host: str = field(default_factory=lambda: os.getenv("BRIDGE_FEEDBACK_HOST", "127.0.0.1"))
    # 0 disables the feedback listener (tests, or a send-only setup).
    feedback_port: int = field(default_factory=lambda: int(os.getenv("BRIDGE_FEEDBACK_PORT", "9000")))
    wire: str = field(default_factory=lambda: os.getenv("BRIDGE_WIRE", "osc"))
    osc_address: str = field(default_factory=lambda: os.getenv("BRIDGE_OSC_ADDRESS", "/musaix/command"))
    rate_hz: float = field(default_factory=lambda: float(os.getenv("BRIDGE_RATE_HZ", "8")))
    snapshot_timeout: float = field(default_factory=lambda: float(os.getenv("BRIDGE_SNAPSHOT_TIMEOUT", "1.5")))
    queue_size: int = 64


@dataclass
class _Job:
    envelope: dict[str, Any]
    done: asyncio.Future[None]


class Executor:
    """Single rate-limited, panic-aware path to Ableton."""

    def __init__(self, settings: Settings, transport: Transport) -> None:
        self.settings = settings
        self.transport = transport
        self.queue: asyncio.Queue[_Job] = asyncio.Queue(maxsize=settings.queue_size)
        self.last_snapshot: Any = None
        self.last_snapshot_at: float | None = None
        self.last_feedback_at: float | None = None
        self.feedback: deque[dict[str, Any]] = deque(maxlen=100)
        self._snapshot_waiters: list[asyncio.Future[Any]] = []
        self._task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        self._task = asyncio.create_task(self._drain())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _drain(self) -> None:
        interval = 1.0 / self.settings.rate_hz if self.settings.rate_hz > 0 else 0.0
        while True:
            job = await self.queue.get()
            try:
                self.transport.send(job.envelope)
                if not job.done.done():
                    job.done.set_result(None)
            except Exception as exc:  # surfaced to the HTTP caller
                if not job.done.done():
                    job.done.set_exception(exc)
            if interval:
                await asyncio.sleep(interval)

    def _flush(self) -> int:
        dropped = 0
        while not self.queue.empty():
            job = self.queue.get_nowait()
            if not job.done.done():
                job.done.set_exception(RuntimeError("Dropped by panic"))
            dropped += 1
        return dropped

    async def submit(self, envelope: dict[str, Any]) -> dict[str, Any]:
        if envelope["type"] == PANIC:
            dropped = self._flush()
            self.transport.send(envelope)  # bypasses the queue on purpose
            return {"sent": True, "dropped": dropped}

        waiter: asyncio.Future[Any] | None = None
        if envelope["type"] == SNAPSHOT:
            waiter = asyncio.get_running_loop().create_future()
            self._snapshot_waiters.append(waiter)

        done = asyncio.get_running_loop().create_future()
        try:
            self.queue.put_nowait(_Job(envelope, done))
        except asyncio.QueueFull:
            if waiter:
                self._snapshot_waiters.remove(waiter)
            raise HTTPException(429, "Bridge queue full — slow down or panic")
        await done

        if waiter is None:
            return {"sent": True}
        try:
            snapshot = await asyncio.wait_for(waiter, self.settings.snapshot_timeout)
            return {"sent": True, "snapshot": snapshot}
        except asyncio.TimeoutError:
            if waiter in self._snapshot_waiters:
                self._snapshot_waiters.remove(waiter)
            # Fall back to the last known state rather than failing the turn.
            return {
                "sent": True,
                "snapshot": self.last_snapshot,
                "stale": True,
                "snapshot_age_s": None if self.last_snapshot_at is None else round(time.time() - self.last_snapshot_at, 1),
            }

    def on_feedback(self, address: str, payload: Any) -> None:
        now = time.time()
        self.last_feedback_at = now
        self.feedback.append({"address": address, "payload": payload, "at": now})
        if address.endswith("state") or address.endswith("snapshot") or address == SNAPSHOT:
            self.last_snapshot, self.last_snapshot_at = payload, now
            waiters, self._snapshot_waiters = self._snapshot_waiters, []
            for w in waiters:
                if not w.done():
                    w.set_result(payload)


class _FeedbackProtocol(asyncio.DatagramProtocol):
    def __init__(self, executor: Executor) -> None:
        self.executor = executor

    def datagram_received(self, data: bytes, addr: Any) -> None:
        try:
            self.executor.on_feedback(*decode_feedback(data))
        except Exception:
            pass  # malformed feedback is ignored, never fatal


class CommandIn(BaseModel):
    type: str
    args: dict[str, Any] = {}


def create_app(settings: Settings | None = None, transport: Transport | None = None) -> FastAPI:
    settings = settings or Settings()
    transport = transport or UdpTransport(settings.live_host, settings.live_port, settings.wire, settings.osc_address)
    executor = Executor(settings, transport)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        await executor.start()
        endpoint = None
        if settings.feedback_port:
            endpoint, _ = await asyncio.get_running_loop().create_datagram_endpoint(
                lambda: _FeedbackProtocol(executor), local_addr=(settings.feedback_host, settings.feedback_port)
            )
        try:
            yield
        finally:
            if endpoint:
                endpoint.close()
            await executor.stop()

    app = FastAPI(title="Musaix OSC Bridge", version="0.1.0", lifespan=lifespan)
    app.state.executor = executor

    def require_token(x_bridge_token: str | None = Header(default=None)) -> None:
        if settings.token and not (x_bridge_token and hmac.compare_digest(x_bridge_token, settings.token)):
            raise HTTPException(401, "Bad or missing X-Bridge-Token")

    @app.get("/health")
    def health() -> dict[str, bool]:
        return {"ok": True}

    @app.get("/status", dependencies=[Depends(require_token)])
    def status() -> dict[str, Any]:
        now = time.time()
        age = None if executor.last_feedback_at is None else round(now - executor.last_feedback_at, 1)
        return {
            "ok": True,
            "live": {"host": settings.live_host, "port": settings.live_port, "wire": settings.wire},
            "feedback_port": settings.feedback_port or None,
            # "Connected" = Live has said something in the last 10 s.
            "live_connected": age is not None and age < 10,
            "last_feedback_age_s": age,
            "queue_depth": executor.queue.qsize(),
            "rate_hz": settings.rate_hz,
        }

    @app.post("/commands", dependencies=[Depends(require_token)])
    async def commands(body: CommandIn) -> dict[str, Any]:
        try:
            cmd = parse_command(body.model_dump())
        except ValidationError as exc:
            raise HTTPException(422, exc.errors(include_url=False, include_context=False)) from exc
        envelope = {"id": uuid.uuid4().hex, "source": "alic3x", **cmd.model_dump()}
        try:
            result = await executor.submit(envelope)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(502, f"Send failed: {exc}") from exc
        return {"ok": True, "id": envelope["id"], "type": envelope["type"], **result}

    @app.post("/panic", dependencies=[Depends(require_token)])
    async def panic() -> dict[str, Any]:
        envelope = {"id": uuid.uuid4().hex, "source": "alic3x", "type": PANIC, "args": {}}
        return {"ok": True, **(await executor.submit(envelope))}

    @app.get("/feedback", dependencies=[Depends(require_token)])
    def feedback(limit: int = 20) -> list[dict[str, Any]]:
        return list(executor.feedback)[-max(1, min(limit, 100)) :]

    return app

