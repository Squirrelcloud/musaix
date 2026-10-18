import json

import httpx

from alic3x_bridge.live import MockLive
from alic3x_bridge.uplink import Uplink


def make_uplink(handler):
    client = httpx.AsyncClient(
        base_url="https://backend.test", transport=httpx.MockTransport(handler)
    )
    return Uplink(MockLive(), "https://backend.test", "t", "studio", client=client)


async def test_poll_executes_and_reports():
    posted = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        posted.append((request.url.path, body))
        if request.url.path == "/api/bridge/poll":
            return httpx.Response(
                200, json={"command": {"id": "c1", "tool": "tempo.set", "args": {"bpm": 100}}}
            )
        return httpx.Response(200, json={"ok": True})

    uplink = make_uplink(handler)
    command = await uplink.poll_once()
    await uplink.execute(command)

    poll, result = posted
    assert poll[1]["bridge_id"] == "studio"
    assert result[0] == "/api/bridge/result"
    assert result[1]["ok"] is True
    assert result[1]["result"] == {"tempo": 100.0}
    assert result[1]["state"]["tempo"] == 100.0


async def test_failed_tool_reports_error():
    results = []

    def handler(request: httpx.Request) -> httpx.Response:
        results.append(json.loads(request.content))
        return httpx.Response(200, json={"ok": True})

    uplink = make_uplink(handler)
    await uplink.execute({"id": "c2", "tool": "scene.fire", "args": {"index": 99}})
    assert results[0]["ok"] is False
    assert "does not exist" in results[0]["error"]


async def test_empty_poll():
    uplink = make_uplink(lambda r: httpx.Response(200, json={"command": None}))
    assert await uplink.poll_once() is None
    assert uplink.connected


async def test_result_delivery_retries_transient_failures(monkeypatch):
    monkeypatch.setattr("alic3x_bridge.uplink.RESULT_RETRY_BASE_S", 0)
    attempts = []

    def handler(request: httpx.Request) -> httpx.Response:
        attempts.append(request.url.path)
        if len(attempts) == 1:
            raise httpx.ConnectError("boom", request=request)
        if len(attempts) == 2:
            return httpx.Response(503)
        return httpx.Response(200, json={"ok": True})

    uplink = make_uplink(handler)
    await uplink.execute({"id": "c3", "tool": "transport.stop", "args": {}})
    assert attempts == ["/api/bridge/result"] * 3


async def test_result_delivery_gives_up_without_raising(monkeypatch):
    monkeypatch.setattr("alic3x_bridge.uplink.RESULT_RETRY_BASE_S", 0)
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(1)
        return httpx.Response(502)

    uplink = make_uplink(handler)
    await uplink.execute({"id": "c4", "tool": "transport.stop", "args": {}})
    assert len(calls) == 5


async def test_result_conflict_is_not_retried(monkeypatch):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(1)
        return httpx.Response(409, json={"error": "command not claimed"})

    uplink = make_uplink(handler)
    await uplink.execute({"id": "c5", "tool": "transport.stop", "args": {}})
    assert len(calls) == 1
