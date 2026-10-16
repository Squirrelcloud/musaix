"""Validated command envelopes.

Mirrors the tool registry in ``src/lib/alic3x/tools.ts``: every command the
brain can send has a strict schema here too, so the bridge never forwards a
malformed or unknown message to Ableton, whatever the caller.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, create_model

Index = Annotated[int, Field(ge=0)]
Unit = Annotated[float, Field(ge=0.0, le=1.0)]


class _Args(BaseModel):
    model_config = ConfigDict(extra="forbid")


class NoArgs(_Args):
    pass


class TempoArgs(_Args):
    bpm: Annotated[float, Field(ge=20, le=999)]


class SceneArgs(_Args):
    scene: Index


class ClipArgs(_Args):
    track: Index
    slot: Index


class VolumeArgs(_Args):
    track: Index
    volume: Unit


class MuteArgs(_Args):
    track: Index
    muted: bool


class SoloArgs(_Args):
    track: Index
    soloed: bool


class DeviceParamArgs(_Args):
    track: Index
    device: Index
    parameter: Index
    value: Unit


def _cmd(name: str, args_model: type[_Args]) -> type[BaseModel]:
    return create_model(
        name.replace(".", "_"),
        __config__=ConfigDict(extra="forbid"),
        type=(Literal[name], ...),  # type: ignore[valid-type]
        args=(args_model, Field(default_factory=args_model)),
    )


COMMAND_ARGS: dict[str, type[_Args]] = {
    "state.snapshot": NoArgs,
    "transport.play": NoArgs,
    "transport.stop": NoArgs,
    "transport.set_tempo": TempoArgs,
    "scene.fire": SceneArgs,
    "clip.fire": ClipArgs,
    "track.set_volume": VolumeArgs,
    "track.mute": MuteArgs,
    "track.solo": SoloArgs,
    "device.set_parameter": DeviceParamArgs,
    "panic.stop_all": NoArgs,
}

_models = tuple(_cmd(name, args) for name, args in COMMAND_ARGS.items())
Command = Annotated[Union[_models], Field(discriminator="type")]  # type: ignore[valid-type]
command_adapter: TypeAdapter[Any] = TypeAdapter(Command)


def parse_command(payload: Any) -> BaseModel:
    """Validate a raw ``{"type", "args"}`` payload. Raises ``pydantic.ValidationError``."""
    return command_adapter.validate_python(payload)
