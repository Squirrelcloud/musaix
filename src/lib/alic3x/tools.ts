import { z } from "zod";

/**
 * Alic3X tool registry — the single source of truth for what the Tool Brain may
 * do. Each tool has a zod schema (validated before anything executes), a target
 * (`bridge` = forwarded to the FastAPI OSC bridge as a command envelope, `brain`
 * = handled inside the backend), and the modes allowed to use it.
 *
 * Client-safe: no server imports. The console reads names/labels from here.
 */

export const MODES = ["produce", "mix", "perform", "chat"] as const;
export type Mode = (typeof MODES)[number];

export const MODE_LABELS: Record<Mode, { label: string; hint: string }> = {
  produce: { label: "Produce", hint: "Arrange, write, build the session" },
  mix: { label: "Mix", hint: "Levels, mutes, device parameters" },
  perform: { label: "Perform", hint: "Transport and scenes, fast and terse" },
  chat: { label: "Chat", hint: "Talk it through — no Ableton control" },
};

const trackIndex = z.number().int().min(0).describe("Zero-based track index");

type ToolDef = {
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  target: "bridge" | "brain";
  /** Bridge command type (MusaixPROOSC envelope `type`). Only for bridge tools. */
  command?: string;
  modes: readonly Mode[];
};

const CONTROL: readonly Mode[] = ["produce", "mix", "perform"];
const ALL: readonly Mode[] = MODES;

export const TOOLS = {
  get_live_state: {
    description:
      "Snapshot Ableton's current state: tempo, transport, tracks, scenes, clips. Call before acting when you are unsure of the set.",
    schema: z.object({}),
    target: "bridge",
    command: "state.snapshot",
    modes: CONTROL,
  },
  transport_play: {
    description: "Start Ableton playback.",
    schema: z.object({}),
    target: "bridge",
    command: "transport.play",
    modes: CONTROL,
  },
  transport_stop: {
    description: "Stop Ableton playback.",
    schema: z.object({}),
    target: "bridge",
    command: "transport.stop",
    modes: CONTROL,
  },
  set_tempo: {
    description: "Set the song tempo in BPM.",
    schema: z.object({ bpm: z.number().min(20).max(999) }),
    target: "bridge",
    command: "transport.set_tempo",
    modes: ["produce", "perform"],
  },
  fire_scene: {
    description: "Launch a scene by zero-based index.",
    schema: z.object({ scene: z.number().int().min(0) }),
    target: "bridge",
    command: "scene.fire",
    modes: ["produce", "perform"],
  },
  fire_clip: {
    description: "Launch one clip slot.",
    schema: z.object({ track: trackIndex, slot: z.number().int().min(0) }),
    target: "bridge",
    command: "clip.fire",
    modes: ["produce", "perform"],
  },
  set_track_volume: {
    description: "Set a track's volume fader, 0.0 (silent) to 1.0 (max). 0.85 is 0 dB.",
    schema: z.object({ track: trackIndex, volume: z.number().min(0).max(1) }),
    target: "bridge",
    command: "track.set_volume",
    modes: ["produce", "mix"],
  },
  mute_track: {
    description: "Mute or unmute a track.",
    schema: z.object({ track: trackIndex, muted: z.boolean() }),
    target: "bridge",
    command: "track.mute",
    modes: CONTROL,
  },
  solo_track: {
    description: "Solo or unsolo a track.",
    schema: z.object({ track: trackIndex, soloed: z.boolean() }),
    target: "bridge",
    command: "track.solo",
    modes: ["produce", "mix"],
  },
  set_device_parameter: {
    description:
      "Set a device parameter on a track (e.g. a plugin knob). Value is normalised 0.0–1.0.",
    schema: z.object({
      track: trackIndex,
      device: z.number().int().min(0).describe("Zero-based device index on the track"),
      parameter: z.number().int().min(0).describe("Zero-based parameter index"),
      value: z.number().min(0).max(1),
    }),
    target: "bridge",
    command: "device.set_parameter",
    modes: ["produce", "mix"],
  },
  panic: {
    description:
      "Emergency stop: halt transport, stop all clips, flush the bridge queue. Use immediately if Sterling says stop/panic/kill it.",
    schema: z.object({}),
    target: "bridge",
    command: "panic.stop_all",
    modes: ALL,
  },
  search_knowledge: {
    description: "Search project docs and notes (the knowledge base) for relevant context.",
    schema: z.object({ query: z.string().min(2).max(300) }),
    target: "brain",
    modes: ALL,
  },
  remember: {
    description:
      "Save a durable fact or preference about Sterling or the project to long-term memory.",
    schema: z.object({ content: z.string().min(3).max(1000) }),
    target: "brain",
    modes: ALL,
  },
} satisfies Record<string, ToolDef>;

export type ToolName = keyof typeof TOOLS;

export function isToolName(name: string): name is ToolName {
  return Object.hasOwn(TOOLS, name);
}

export function toolsForMode(mode: Mode): ToolName[] {
  return (Object.keys(TOOLS) as ToolName[]).filter((name) =>
    (TOOLS[name].modes as readonly Mode[]).includes(mode),
  );
}

/** OpenAI-compatible `tools` array (AI Gateway and OpenRouter both accept it). */
export function toolSpecsForMode(mode: Mode) {
  return toolsForMode(mode).map((name) => {
    const { $schema: _drop, ...parameters } = z.toJSONSchema(TOOLS[name].schema) as Record<
      string,
      unknown
    >;
    return {
      type: "function" as const,
      function: { name, description: TOOLS[name].description, parameters },
    };
  });
}

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** One entry in the console's Tool Feed. */
export type ToolEvent = {
  id: string;
  tool: string;
  args: Json;
  ok: boolean;
  result?: Json;
  error?: string;
  ms: number;
  at: string;
};
