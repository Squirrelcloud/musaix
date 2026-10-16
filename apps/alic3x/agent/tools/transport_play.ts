import { defineTool } from "eve/tools";
import { z } from "zod";
import { runBridgeTool } from "../lib/bridge";

export default defineTool({
  description: "Start Ableton playback.",
  inputSchema: z.object({}),
  label: { start: () => "Play" },
  execute: (input, ctx) => runBridgeTool("transport_play", "transport.play", input, ctx),
});
