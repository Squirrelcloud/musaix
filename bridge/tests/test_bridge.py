import asyncio
import json
import socket
import time

import pytest
from fastapi.testclient import TestClient
from pythonosc.osc_message import OscMessage

from musaix_bridge.app import Executor, Settings, create_app
from musaix_bridge.transport import UdpTransport, decode_feedback, encode


class FakeTransport:
    def __init__(self):
        self.sent = []

    def send(self, envelope):
        self.sent.append(envelope)


def make(token="secret", **kw):
    settings = Settings(token=token, feedback_port=0, rate_hz=0, snapshot_timeout=0.05, **kw)
    transport = FakeTransport()
    return create_app(settings, transport), transport


H = {"x-bridge-token": "secret"}


def test_health_is_open_but_everything_else_needs_token():
    app, _ = make()
    with TestClient(app) as c:
        assert c.get("/health").json() == {"ok": True}
        assert c.get("/status").status_code == 401
        assert c.post("/commands", json={"type": "transport.play"}, headers={"x-bridge-token": "nope"}).status_code == 401
        assert c.get("/status", headers=H).json()["queue_depth"] == 0


def test_valid_command_is_sent_as_envelope():
    app, t = make()
    with TestClient(app) as c:
        r = c.post("/commands", json={"type": "transport.set_tempo", "args": {"bpm": 92}}, headers=H)
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True
    assert len(t.sent) == 1
    env = t.sent[0]
    assert env["type"] == "transport.set_tempo" and env["args"] == {"bpm": 92.0}
    assert env["source"] == "alic3x" and len(env["id"]) == 32


@pytest.mark.parametrize(
    "payload",
    [
        {"type": "transport.set_tempo", "args": {"bpm": 5000}},
        {"type": "track.set_volume", "args": {"track": -1, "volume": 0.5}},
        {"type": "track.set_volume", "args": {"track": 0, "volume": 0.5, "extra": 1}},
        {"type": "song.delete_everything", "args": {}},
    ],
)
def test_invalid_commands_never_reach_ableton(payload):
    app, t = make()
    with TestClient(app) as c:
        assert c.post("/commands", json=payload, headers=H).status_code == 422
    assert t.sent == []


def test_snapshot_falls_back_to_last_known_state_when_live_is_silent():
    app, _ = make()
    with TestClient(app) as c:
        app.state.executor.on_feedback("/musaix/state", {"tempo": 120})
        r = c.post("/commands", json={"type": "state.snapshot"}, headers=H).json()
        assert r["snapshot"] == {"tempo": 120} and r["stale"] is True


def test_panic_endpoint_sends_immediately():
    app, t = make()
    with TestClient(app) as c:
        r = c.post("/panic", headers=H).json()
        assert r["ok"] and r["sent"]
    assert t.sent[-1]["type"] == "panic.stop_all"


def test_no_token_configured_means_open_for_local_dev():
    app, _ = make(token=None)
    with TestClient(app) as c:
        assert c.get("/status").status_code == 200


def test_executor_rate_limits_and_panic_flushes_queue():
    async def run():
        t = FakeTransport()
        ex = Executor(Settings(feedback_port=0, rate_hz=20), t)
        await ex.start()
        started = time.monotonic()
        await asyncio.gather(*(ex.submit({"type": "transport.play", "args": {}}) for _ in range(4)))
        elapsed = time.monotonic() - started
        # 4 sends at 20 Hz: at least 3 inter-command gaps of 50 ms.
        assert elapsed >= 0.14, elapsed
        # Queue a burst, then panic before it drains.
        pending = [asyncio.create_task(ex.submit({"type": "scene.fire", "args": {"scene": i}})) for i in range(10)]
        await asyncio.sleep(0)
        res = await ex.submit({"type": "panic.stop_all", "args": {}})
        results = await asyncio.gather(*pending, return_exceptions=True)
        await ex.stop()
        assert res["dropped"] >= 8
        assert sum(isinstance(r, RuntimeError) for r in results) == res["dropped"]
        assert t.sent[-1]["type"] == "panic.stop_all"

    asyncio.run(run())


def test_snapshot_waiter_resolves_from_feedback():
    async def run():
        ex = Executor(Settings(feedback_port=0, rate_hz=0, snapshot_timeout=1), FakeTransport())
        await ex.start()
        task = asyncio.create_task(ex.submit({"type": "state.snapshot", "args": {}}))
        await asyncio.sleep(0.01)
        ex.on_feedback("/musaix/state", {"tempo": 92, "playing": True})
        res = await task
        await ex.stop()
        assert res["snapshot"] == {"tempo": 92, "playing": True} and "stale" not in res

    asyncio.run(run())


def test_wire_encodings_roundtrip():
    env = {"id": "x", "type": "transport.play", "args": {}}
    msg = OscMessage(encode(env, "osc", "/musaix/command"))
    assert msg.address == "/musaix/command" and json.loads(msg.params[0]) == env
    assert json.loads(encode(env, "json", "")) == env
    with pytest.raises(ValueError):
        encode(env, "midi", "")
    assert decode_feedback(encode({"tempo": 1}, "osc", "/musaix/state")) == ("/musaix/state", {"tempo": 1})
    assert decode_feedback(b'{"type":"/musaix/state","tempo":1}')[0] == "/musaix/state"


def test_udp_transport_really_sends_osc():
    rx = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    rx.bind(("127.0.0.1", 0))
    rx.settimeout(2)
    UdpTransport("127.0.0.1", rx.getsockname()[1], "osc", "/musaix/command").send({"type": "transport.stop", "args": {}})
    data, _ = rx.recvfrom(4096)
    assert OscMessage(data).address == "/musaix/command"
