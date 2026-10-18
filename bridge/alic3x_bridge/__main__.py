"""Run the bridge: `python -m alic3x_bridge` (config via env, see bridge/README.md)."""

from __future__ import annotations

import asyncio
import logging
import os
import socket

import uvicorn

from .app import create_app
from .live import AbletonOSCAdapter, LiveAdapter, MockLive
from .uplink import Uplink

log = logging.getLogger("alic3x_bridge")


def make_live() -> LiveAdapter:
    kind = os.environ.get("LIVE_ADAPTER", "abletonosc")
    if kind == "mock":
        return MockLive()
    if kind == "abletonosc":
        return AbletonOSCAdapter(
            host=os.environ.get("ABLETON_HOST", "127.0.0.1"),
            send_port=int(os.environ.get("ABLETON_SEND_PORT", "11000")),
            listen_port=int(os.environ.get("ABLETON_LISTEN_PORT", "11001")),
        )
    raise SystemExit(f"unknown LIVE_ADAPTER={kind!r} (use abletonosc or mock)")


async def amain() -> None:
    live = make_live()
    await live.start()

    backend = os.environ.get("ALIC3X_BACKEND_URL", "").strip()
    token = os.environ.get("BRIDGE_TOKEN", "").strip()
    uplink = None
    if backend:
        if not token:
            raise SystemExit("ALIC3X_BACKEND_URL is set but BRIDGE_TOKEN is empty")
        bridge_id = os.environ.get("BRIDGE_ID") or socket.gethostname()
        uplink = Uplink(live, backend, token, bridge_id)
        log.info("uplink: %s as %s", backend, bridge_id)
    else:
        log.info("no ALIC3X_BACKEND_URL — local-only mode")

    port = int(os.environ.get("BRIDGE_PORT", "8765"))
    server = uvicorn.Server(
        uvicorn.Config(create_app(live, uplink), host="127.0.0.1", port=port, log_level="info")
    )
    tasks = [asyncio.create_task(server.serve())]
    if uplink:
        tasks.append(asyncio.create_task(uplink.run()))
    try:
        done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for t in done:
            t.result()
    finally:
        for t in tasks:
            t.cancel()
        if uplink:
            await uplink.close()
        await live.close()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    try:
        asyncio.run(amain())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
