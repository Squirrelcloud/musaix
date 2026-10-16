import { defineTool } from "eve/tools";
import { z } from "zod";
import { runBridgeTool } from "../lib/bridge";

export default defineTool({
  description: "Mute or unmute a track.",
  inputSchema: z.object({
    track: z.number().int().min(0).describe("Zero-based track index"),
    muted: z.boolean(),
  }),
  label: { start: (input) => `${input.muted ? "Mute" : "Unmute"} track ${input.track + 1}` },
  execute: (input, ctx) => runBridgeTool("mute_track", "track.mute", input, ctx),
});
