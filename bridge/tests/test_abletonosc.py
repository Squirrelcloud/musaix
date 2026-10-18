"""Exercise AbletonOSCAdapter over real UDP against a fake AbletonOSC peer."""

import asyncio
import socket

from pythonosc.dispatcher import Dispatcher
from pythonosc.osc_server import AsyncIOOSCUDPServer
from pythonosc.udp_client import SimpleUDPClient

from alic3x_bridge.live import AbletonOSCAdapter
from alic3x_bridge.tools import run_tool


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


async def test_wire_format_against_fake_live():
    live_port, reply_port = free_port(), free_port()
    reply = SimpleUDPClient("127.0.0.1", reply_port)
    song = {"tempo": 120.0, "is_playing": 0}
    received = []

    def on(address, *args):
        received.append(address)
        if address == "/live/song/set/tempo":
            song["tempo"] = float(args[0])
            reply.send_message("/live/song/get/tempo", [song["tempo"]])  # listener push
        elif address == "/live/song/start_playing":
            song["is_playing"] = 1
        elif address.startswith("/live/song/get/"):
            reply.send_message(address, [song[address.rsplit("/", 1)[-1]]])

    dispatcher = Dispatcher()
    dispatcher.set_default_handler(on)
    fake = AsyncIOOSCUDPServer(("127.0.0.1", live_port), dispatcher, asyncio.get_running_loop())
    transport, _ = await fake.create_serve_endpoint()

    adapter = AbletonOSCAdapter(send_port=live_port, listen_port=reply_port)
    await adapter.start()
    try:
        assert await run_tool(adapter, "tempo.set", {"bpm": 133}) == {"tempo": 133.0}
        assert await run_tool(adapter, "transport.play", {}) == {"is_playing": True}
        assert adapter.state["tempo"] == 133.0
        assert "/live/song/start_listen/tempo" in received
    finally:
        await adapter.close()
        transport.close()
