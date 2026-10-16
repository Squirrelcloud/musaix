import { defineTool } from "eve/tools";
import { z } from "zod";
import { runBridgeTool } from "../lib/bridge";

export default defineTool({
  description: "Launch one clip slot.",
  inputSchema: z.object({
    track: z.number().int().min(0).describe("Zero-based track index"),
    slot: z.number().int().min(0),
  }),
  label: { start: (input) => `Launch clip ${input.track + 1}:${input.slot + 1}` },
  execute: (input, ctx) => runBridgeTool("fire_clip", "clip.fire", input, ctx),
});
