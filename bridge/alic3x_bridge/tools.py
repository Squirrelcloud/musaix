"""Tool execution against Live, with readback verification.

Mirrors the registry in `src/lib/alic3x/tools.ts`. Every call is re-validated
here — the bridge is the last gate before Live, so it does not trust the
backend's validation. OSC is fire-and-forget UDP, so state-changing tools read
the value back and fail loudly if Live did not take it.
"""

from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .live import LiveAdapter, LiveError


class ToolError(RuntimeError):
    pass


class _Args(BaseModel):
    model_config = ConfigDict(extra="forbid")


class NoArgs(_Args):
    pass


class TempoArgs(_Args):
    bpm: float = Field(ge=20, le=999)


class SceneArgs(_Args):
    index: int = Field(ge=0)


class MuteArgs(_Args):
    track: int = Field(ge=0)
    muted: bool


async def _verify(
    read: Callable[[], Awaitable[Any]],
    ok: Callable[[Any], bool],
    what: str,
    attempts: int = 5,
    delay: float = 0.05,
) -> Any:
    value = None
    for _ in range(attempts):
        value = await read()
        if ok(value):
            return value
        await asyncio.sleep(delay)
    raise ToolError(f"{what} not confirmed by Live (last read: {value!r})")


async def _tempo(live: LiveAdapter) -> float:
    return float((await live.query("/live/song/get/tempo"))[0])


async def _is_playing(live: LiveAdapter) -> bool:
    return bool((await live.query("/live/song/get/is_playing"))[0])


async def _count(live: LiveAdapter, what: str) -> int:
    return int((await live.query(f"/live/song/get/num_{what}"))[0])


async def snapshot(live: LiveAdapter) -> dict[str, Any]:
    state = {
        "tempo": await _tempo(live),
        "is_playing": await _is_playing(live),
        "num_tracks": await _count(live, "tracks"),
        "num_scenes": await _count(live, "scenes"),
    }
    live.state.update(state)
    return state


async def _transport(live: LiveAdapter, address: str, playing: bool) -> dict[str, Any]:
    await live.send(address)
    await _verify(lambda: _is_playing(live), lambda v: v is playing, "transport state")
    return {"is_playing": playing}


async def _play(live: LiveAdapter, _: NoArgs) -> dict[str, Any]:
    return await _transport(live, "/live/song/start_playing", True)


async def _continue(live: LiveAdapter, _: NoArgs) -> dict[str, Any]:
    return await _transport(live, "/live/song/continue_playing", True)


async def _stop(live: LiveAdapter, _: NoArgs) -> dict[str, Any]:
    return await _transport(live, "/live/song/stop_playing", False)


async def _set_tempo(live: LiveAdapter, args: TempoArgs) -> dict[str, Any]:
    await live.send("/live/song/set/tempo", float(args.bpm))
    tempo = await _verify(
        lambda: _tempo(live), lambda v: abs(v - args.bpm) < 0.01, f"tempo {args.bpm}"
    )
    return {"tempo": tempo}


async def _fire_scene(live: LiveAdapter, args: SceneArgs) -> dict[str, Any]:
    scenes = await _count(live, "scenes")
    if args.index >= scenes:
        raise ToolError(f"scene {args.index} does not exist (set has {scenes} scenes)")
    await live.send("/live/scene/fire", args.index)
    # Live starts the transport when a scene fires, so a stopped transport means
    # the launch was lost. Which clips launched is not observable from here yet,
    # so say so instead of claiming it.
    await _verify(lambda: _is_playing(live), lambda v: v is True, f"scene {args.index} launch")
    return {"fired": args.index, "transport_playing": True, "clip_launch_confirmed": False}


async def _mute(live: LiveAdapter, args: MuteArgs) -> dict[str, Any]:
    tracks = await _count(live, "tracks")
    if args.track >= tracks:
        raise ToolError(f"track {args.track} does not exist (set has {tracks} tracks)")
    await live.send("/live/track/set/mute", args.track, int(args.muted))

    async def read() -> bool:
        return bool((await live.query("/live/track/get/mute", args.track))[1])

    await _verify(read, lambda v: v is args.muted, f"track {args.track} mute")
    return {"track": args.track, "muted": args.muted}


async def _snapshot(live: LiveAdapter, _: NoArgs) -> dict[str, Any]:
    return await snapshot(live)


async def _panic(live: LiveAdapter, _: NoArgs) -> dict[str, Any]:
    # No readback gate: a panic must send both stops even if Live is slow to answer.
    await live.send("/live/song/stop_all_clips")
    await live.send("/live/song/stop_playing")
    return {"stopped": True}


TOOLS: dict[str, tuple[type[_Args], Callable[[LiveAdapter, Any], Awaitable[dict[str, Any]]]]] = {
    "transport.play": (NoArgs, _play),
    "transport.continue": (NoArgs, _continue),
    "transport.stop": (NoArgs, _stop),
    "tempo.set": (TempoArgs, _set_tempo),
    "scene.fire": (SceneArgs, _fire_scene),
    "track.mute": (MuteArgs, _mute),
    "state.snapshot": (NoArgs, _snapshot),
    "panic.stop_all": (NoArgs, _panic),
}


async def run_tool(live: LiveAdapter, tool: str, args: dict[str, Any] | None) -> dict[str, Any]:
    """Validate and execute one tool call. Raises ToolError with a readable message."""
    if tool not in TOOLS:
        raise ToolError(f"unknown tool: {tool}")
    model, fn = TOOLS[tool]
    try:
        parsed = model.model_validate(args or {})
    except ValidationError as e:
        raise ToolError(f"invalid args for {tool}: {e.errors(include_url=False)}") from None
    try:
        return await fn(live, parsed)
    except LiveError as e:
        raise ToolError(str(e)) from None
