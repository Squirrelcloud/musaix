import pytest

from alic3x_bridge.live import MockLive
from alic3x_bridge.tools import ToolError, run_tool


async def test_transport_round_trip():
    live = MockLive()
    assert await run_tool(live, "transport.play", {}) == {"is_playing": True}
    assert await run_tool(live, "transport.stop", {}) == {"is_playing": False}


async def test_set_tempo_reads_back():
    live = MockLive()
    assert await run_tool(live, "tempo.set", {"bpm": 128}) == {"tempo": 128.0}
    assert live.state["tempo"] == 128.0


async def test_tempo_not_confirmed_fails():
    class StubbornLive(MockLive):
        async def send(self, address, *args):
            if address != "/live/song/set/tempo":
                await super().send(address, *args)

    with pytest.raises(ToolError, match="not confirmed"):
        await run_tool(StubbornLive(), "tempo.set", {"bpm": 90})


async def test_mute_bounds_and_readback():
    live = MockLive(num_tracks=2)
    assert await run_tool(live, "track.mute", {"track": 1, "muted": True}) == {
        "track": 1,
        "muted": True,
    }
    assert live.mutes == [False, True]
    with pytest.raises(ToolError, match="does not exist"):
        await run_tool(live, "track.mute", {"track": 2, "muted": True})


async def test_scene_bounds():
    live = MockLive(num_scenes=3)
    await run_tool(live, "scene.fire", {"index": 2})
    assert live.fired_scenes == [2]
    with pytest.raises(ToolError, match="does not exist"):
        await run_tool(live, "scene.fire", {"index": 3})


@pytest.mark.parametrize(
    "tool,args",
    [
        ("tempo.set", {"bpm": 5}),
        ("tempo.set", {}),
        ("track.mute", {"track": 0}),
        ("transport.play", {"extra": 1}),
        ("track.delete", {}),
    ],
)
async def test_rejects_bad_calls(tool, args):
    with pytest.raises(ToolError):
        await run_tool(MockLive(), tool, args)


async def test_panic_sends_both_stops():
    live = MockLive()
    await run_tool(live, "panic.stop_all", {})
    assert [a for a, _ in live.sent] == ["/live/song/stop_all_clips", "/live/song/stop_playing"]


async def test_snapshot():
    snap = await run_tool(MockLive(num_tracks=3, num_scenes=5), "state.snapshot", {})
    assert snap == {"tempo": 120.0, "is_playing": False, "num_tracks": 3, "num_scenes": 5}


async def test_scene_fire_fails_when_transport_never_starts():
    class DeafLive(MockLive):
        async def send(self, address, *args):
            if address != "/live/scene/fire":
                await super().send(address, *args)

    with pytest.raises(ToolError, match="scene 0 launch"):
        await run_tool(DeafLive(), "scene.fire", {"index": 0})


async def test_scene_fire_reports_what_it_confirmed():
    result = await run_tool(MockLive(), "scene.fire", {"index": 1})
    assert result == {"fired": 1, "transport_playing": True, "clip_launch_confirmed": False}
