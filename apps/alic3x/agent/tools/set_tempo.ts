import { defineTool } from "eve/tools";
import { z } from "zod";
import { runBridgeTool } from "../lib/bridge";

export default defineTool({
  description: "Set the song tempo in BPM.",
  inputSchema: z.object({ bpm: z.number().min(20).max(999) }),
  label: { start: (input) => `Tempo → ${input.bpm} BPM` },
  execute: (input, ctx) => runBridgeTool("set_tempo", "transport.set_tempo", input, ctx),
});
