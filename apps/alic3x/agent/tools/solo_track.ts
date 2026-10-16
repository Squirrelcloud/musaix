import { defineTool } from "eve/tools";
import { z } from "zod";
import { runBridgeTool } from "../lib/bridge";

export default defineTool({
  description: "Solo or unsolo a track.",
  inputSchema: z.object({
    track: z.number().int().min(0).describe("Zero-based track index"),
    soloed: z.boolean(),
  }),
  label: { start: (input) => `${input.soloed ? "Solo" : "Unsolo"} track ${input.track + 1}` },
  execute: (input, ctx) => runBridgeTool("solo_track", "track.solo", input, ctx),
});
