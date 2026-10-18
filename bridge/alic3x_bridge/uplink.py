"""Outbound link to the Musaix backend.

The bridge sits behind NAT next to Ableton, so it dials out: it long-polls
`POST /api/bridge/poll` (which doubles as a heartbeat carrying Live's cached
state), runs each claimed command, and posts the outcome to
`POST /api/bridge/result`. Network errors back off exponentially; the backend
expires commands nobody claims, so nothing piles up while the bridge is away.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from .live import LiveAdapter
from .tools import ToolError, run_tool

log = logging.getLogger(__name__)

POLL_WAIT_MS = 20_000
TOOL_TIMEOUT_S = 5.0
MAX_BACKOFF_S = 30.0


class Uplink:
    def __init__(
        self,
        live: LiveAdapter,
        backend_url: str,
        token: str,
        bridge_id: str,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.live = live
        self.bridge_id = bridge_id
        self._client = client or httpx.AsyncClient(
            base_url=backend_url.rstrip("/"),
            headers={"Authorization": f"Bearer {token}"},
            timeout=httpx.Timeout(10.0, read=POLL_WAIT_MS / 1000 + 10),
        )
        self.connected = False

    async def poll_once(self) -> dict[str, Any] | None:
        """One long-poll round trip. Returns the claimed command, if any."""
        res = await self._client.post(
            "/api/bridge/poll",
            json={"bridge_id": self.bridge_id, "state": self.live.state, "wait_ms": POLL_WAIT_MS},
        )
        res.raise_for_status()
        self.connected = True
        return res.json().get("command")

    async def execute(self, command: dict[str, Any]) -> None:
        tool, args = command.get("tool", ""), command.get("args") or {}
        payload: dict[str, Any] = {"id": command["id"], "bridge_id": self.bridge_id}
        try:
            result = await asyncio.wait_for(run_tool(self.live, tool, args), TOOL_TIMEOUT_S)
            payload.update(ok=True, result=result)
            log.info("%s %s -> %s", tool, args, result)
        except (ToolError, asyncio.TimeoutError) as e:
            message = str(e) or f"{tool} timed out after {TOOL_TIMEOUT_S}s"
            payload.update(ok=False, error=message)
            log.warning("%s %s failed: %s", tool, args, message)
        payload["state"] = self.live.state
        res = await self._client.post("/api/bridge/result", json=payload)
        if res.status_code == 409:
            log.warning("backend no longer tracks command %s", command["id"])
        else:
            res.raise_for_status()

    async def run(self) -> None:
        backoff = 1.0
        while True:
            try:
                command = await self.poll_once()
                backoff = 1.0
                if command:
                    await self.execute(command)
            except asyncio.CancelledError:
                raise
            except httpx.HTTPStatusError as e:
                if e.response.status_code in (401, 503):
                    log.error("backend rejected the bridge (%s): check BRIDGE_TOKEN", e.response.text)
                else:
                    log.warning("backend error: %s", e)
                await self._backoff(backoff)
                backoff = min(backoff * 2, MAX_BACKOFF_S)
            except httpx.HTTPError as e:
                log.warning("backend unreachable: %r", e)
                await self._backoff(backoff)
                backoff = min(backoff * 2, MAX_BACKOFF_S)

    async def _backoff(self, seconds: float) -> None:
        self.connected = False
        await asyncio.sleep(seconds)

    async def close(self) -> None:
        await self._client.aclose()
