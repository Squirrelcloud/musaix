import { defineTool } from "eve/tools";
import { z } from "zod";
import { runBridgeTool } from "../lib/bridge";

export default defineTool({
  description: "Set a track's volume fader, 0.0 (silent) to 1.0 (max). 0.85 is 0 dB.",
  inputSchema: z.object({
    track: z.number().int().min(0).describe("Zero-based track index"),
    volume: z.number().min(0).max(1),
  }),
  label: { start: (input) => `Track ${input.track + 1} volume → ${input.volume}` },
  execute: (input, ctx) => runBridgeTool("set_track_volume", "track.set_volume", input, ctx),
});
