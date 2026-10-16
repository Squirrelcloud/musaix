/**
 * Console modes and which tools each one may use. Shared by the agent's tools
 * (server-side enforcement) and the console UI (labels). No runtime imports.
 */

export const MODES = ["produce", "mix", "perform", "chat"] as const;
export type Mode = (typeof MODES)[number];

export const MODE_LABELS: Record<Mode, { label: string; hint: string }> = {
  produce: { label: "Produce", hint: "Arrange, write, build the session" },
  mix: { label: "Mix", hint: "Levels, mutes, device parameters" },
  perform: { label: "Perform", hint: "Transport and scenes, fast and terse" },
  chat: { label: "Chat", hint: "Talk it through — no Ableton control" },
};

const CONTROL: readonly Mode[] = ["produce", "mix", "perform"];

/** Ableton tools by mode. `panic`, `search_knowledge` and `remember` work in every mode. */
export const TOOL_MODES: Record<string, readonly Mode[]> = {
  get_live_state: CONTROL,
  transport_play: CONTROL,
  transport_stop: CONTROL,
  set_tempo: ["produce", "perform"],
  fire_scene: ["produce", "perform"],
  fire_clip: ["produce", "perform"],
  set_track_volume: ["produce", "mix"],
  mute_track: CONTROL,
  solo_track: ["produce", "mix"],
  set_device_parameter: ["produce", "mix"],
  panic: MODES,
};

export function parseMode(value: unknown): Mode {
  return MODES.includes(value as Mode) ? (value as Mode) : "produce";
}

export function toolAllowed(tool: string, mode: Mode): boolean {
  const modes = TOOL_MODES[tool];
  return modes ? modes.includes(mode) : true;
}

/** Header the console (and the ElevenLabs webhook) uses to tell the agent the current mode. */
export const MODE_HEADER = "x-alic3x-mode";
