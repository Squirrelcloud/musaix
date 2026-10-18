import { z } from "zod";

/**
 * Alic3X tool registry — the single list of actions the tool brain may send to
 * Ableton. Shared by the API routes (validation + JSON Schema for LLM tool
 * definitions) and mirrored by the Python bridge (`bridge/alic3x_bridge/tools.py`),
 * which re-validates before anything reaches Live.
 *
 * `destructive` tools need an explicit confirmation step once the voice layer
 * lands; nothing destructive is exposed yet.
 */
export interface ToolDef {
  description: string;
  args: z.ZodType;
  destructive: boolean;
}

const noArgs = z.object({}).strict();

export const TOOLS = {
  "transport.play": {
    description: "Start Live's transport from the start marker.",
    args: noArgs,
    destructive: false,
  },
  "transport.continue": {
    description: "Resume playback from the current position.",
    args: noArgs,
    destructive: false,
  },
  "transport.stop": {
    description: "Stop Live's transport.",
    args: noArgs,
    destructive: false,
  },
  "tempo.set": {
    description: "Set the song tempo in BPM. The bridge reads the tempo back to confirm.",
    args: z.object({ bpm: z.number().min(20).max(999) }).strict(),
    destructive: false,
  },
  "scene.fire": {
    description: "Launch a scene by zero-based index.",
    args: z.object({ index: z.number().int().min(0) }).strict(),
    destructive: false,
  },
  "track.mute": {
    description: "Mute or unmute a track by zero-based index. Reads the mute state back.",
    args: z.object({ track: z.number().int().min(0), muted: z.boolean() }).strict(),
    destructive: false,
  },
  "state.snapshot": {
    description: "Read tempo, transport state, and track/scene counts from Live.",
    args: noArgs,
    destructive: false,
  },
  "panic.stop_all": {
    description: "Stop all clips and the transport immediately.",
    args: noArgs,
    destructive: false,
  },
} satisfies Record<string, ToolDef>;

export type ToolName = keyof typeof TOOLS;

export function isToolName(name: string): name is ToolName {
  return Object.hasOwn(TOOLS, name);
}

/** Tool list with JSON Schema args — the shape an LLM tool definition needs. */
export function toolManifest() {
  return Object.entries(TOOLS).map(([name, def]) => ({
    name,
    description: def.description,
    destructive: def.destructive,
    parameters: z.toJSONSchema(def.args),
  }));
}

export type ParseResult =
  { ok: true; tool: ToolName; args: Record<string, unknown> } | { ok: false; error: string };

export function parseToolCall(tool: unknown, args: unknown): ParseResult {
  if (typeof tool !== "string" || !isToolName(tool)) {
    return { ok: false, error: `unknown tool: ${String(tool)}` };
  }
  const parsed = TOOLS[tool].args.safeParse(args ?? {});
  if (!parsed.success) {
    return { ok: false, error: z.prettifyError(parsed.error) };
  }
  return { ok: true, tool, args: parsed.data as Record<string, unknown> };
}
