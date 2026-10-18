"""Transport to Ableton Live.

`LiveAdapter` is the narrow surface the tools need: fire-and-forget `send` and
request/response `query`, both speaking AbletonOSC addresses
(https://github.com/ideoforms/AbletonOSC). Two implementations:

- `AbletonOSCAdapter`: real UDP OSC. Live listens on 11000 and replies to the
  sender's host on 11001.
- `MockLive`: in-memory Live for tests and for running the bridge without Ableton.

Both keep a `state` cache fed by AbletonOSC listeners, so the bridge can report
Live's state upstream without polling it.
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict, deque
from typing import Any, Protocol

log = logging.getLogger(__name__)


class LiveError(RuntimeError):
    """Live did not answer, or answered with something unexpected."""


class LiveAdapter(Protocol):
    state: dict[str, Any]

    async def start(self) -> None: ...
    async def close(self) -> None: ...
    async def send(self, address: str, *args: Any) -> None: ...
    async def query(self, address: str, *args: Any, timeout: float = 1.0) -> tuple[Any, ...]: ...


# Push updates we subscribe to: AbletonOSC re-sends the getter address on change.
LISTENED = {
    "/live/song/get/tempo": "tempo",
    "/live/song/get/is_playing": "is_playing",
}


def _apply_push(state: dict[str, Any], address: str, args: tuple[Any, ...]) -> None:
    key = LISTENED.get(address)
    if key and args:
        value = args[0]
        state[key] = bool(value) if key == "is_playing" else value


class AbletonOSCAdapter:
    def __init__(
        self,
        host: str = "127.0.0.1",
        send_port: int = 11000,
        listen_port: int = 11001,
        listen_host: str = "127.0.0.1",
    ) -> None:
        self.host = host
        self.listen_host = listen_host
        self.send_port = send_port
        self.listen_port = listen_port
        self.state: dict[str, Any] = {}
        self._pending: dict[str, deque[asyncio.Future[tuple[Any, ...]]]] = defaultdict(deque)
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
        self._transport: asyncio.DatagramTransport | None = None
        self._client = None

    async def start(self) -> None:
        from pythonosc.dispatcher import Dispatcher
        from pythonosc.osc_server import AsyncIOOSCUDPServer
        from pythonosc.udp_client import SimpleUDPClient

        dispatcher = Dispatcher()
        dispatcher.set_default_handler(self._on_message)
        server = AsyncIOOSCUDPServer(
            (self.listen_host, self.listen_port), dispatcher, asyncio.get_running_loop()
        )
        self._transport, _ = await server.create_serve_endpoint()
        self._client = SimpleUDPClient(self.host, self.send_port)
        for address in LISTENED:
            prop = address.rsplit("/", 1)[-1]
            await self.send(f"/live/song/start_listen/{prop}")

    async def close(self) -> None:
        if self._transport:
            for address in LISTENED:
                prop = address.rsplit("/", 1)[-1]
                await self.send(f"/live/song/stop_listen/{prop}")
            self._transport.close()
            self._transport = None

    def _on_message(self, address: str, *args: Any) -> None:
        _apply_push(self.state, address, args)
        waiters = self._pending.get(address)
        while waiters:
            fut = waiters.popleft()
            if not fut.done():
                fut.set_result(tuple(args))
                return
        if address == "/live/error":
            log.warning("AbletonOSC error: %s", args)

    async def send(self, address: str, *args: Any) -> None:
        if self._client is None:
            raise LiveError("adapter not started")
        self._client.send_message(address, list(args))

    async def query(self, address: str, *args: Any, timeout: float = 1.0) -> tuple[Any, ...]:
        # One in-flight query per address: replies carry no request id, so
        # concurrent queries on the same address could swap answers.
        async with self._locks[address]:
            fut: asyncio.Future[tuple[Any, ...]] = asyncio.get_running_loop().create_future()
            self._pending[address].append(fut)
            await self.send(address, *args)
            try:
                return await asyncio.wait_for(fut, timeout)
            except asyncio.TimeoutError:
                raise LiveError(
                    f"no reply to {address} within {timeout}s — is Live running with AbletonOSC?"
                ) from None
            finally:
                if fut in self._pending[address]:
                    self._pending[address].remove(fut)


class MockLive:
    """In-memory Live that answers the AbletonOSC addresses the tools use."""

    def __init__(self, num_tracks: int = 4, num_scenes: int = 8, tempo: float = 120.0) -> None:
        self.state: dict[str, Any] = {"tempo": tempo, "is_playing": False}
        self.num_tracks = num_tracks
        self.num_scenes = num_scenes
        self.mutes = [False] * num_tracks
        self.fired_scenes: list[int] = []
        self.sent: list[tuple[str, tuple[Any, ...]]] = []

    async def start(self) -> None:
        pass

    async def close(self) -> None:
        pass

    async def send(self, address: str, *args: Any) -> None:
        self.sent.append((address, args))
        if address in ("/live/song/start_playing", "/live/song/continue_playing"):
            self.state["is_playing"] = True
        elif address == "/live/song/stop_playing":
            self.state["is_playing"] = False
        elif address == "/live/song/set/tempo":
            self.state["tempo"] = float(args[0])
        elif address == "/live/track/set/mute":
            self.mutes[int(args[0])] = bool(args[1])
        elif address == "/live/scene/fire":
            self.fired_scenes.append(int(args[0]))
            self.state["is_playing"] = True

    async def query(self, address: str, *args: Any, timeout: float = 1.0) -> tuple[Any, ...]:
        if address == "/live/song/get/tempo":
            return (self.state["tempo"],)
        if address == "/live/song/get/is_playing":
            return (int(self.state["is_playing"]),)
        if address == "/live/song/get/num_tracks":
            return (self.num_tracks,)
        if address == "/live/song/get/num_scenes":
            return (self.num_scenes,)
        if address == "/live/track/get/mute":
            return (args[0], int(self.mutes[int(args[0])]))
        raise LiveError(f"MockLive has no answer for {address}")
