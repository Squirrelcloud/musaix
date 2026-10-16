import { defineTool } from "eve/tools";
import { z } from "zod";
import { runBridgeTool } from "../lib/bridge";

export default defineTool({
  description:
    "Snapshot Ableton's current state: tempo, transport, tracks, scenes, clips. Call it before acting when you're unsure of the set.",
  inputSchema: z.object({}),
  label: { start: () => "Read the Live set" },
  execute: (input, ctx) => runBridgeTool("get_live_state", "state.snapshot", input, ctx),
});
