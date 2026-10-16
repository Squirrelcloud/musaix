import { defineTool } from "eve/tools";
import { z } from "zod";
import { runBridgeTool } from "../lib/bridge";

export default defineTool({
  description: "Stop Ableton playback.",
  inputSchema: z.object({}),
  label: { start: () => "Stop" },
  execute: (input, ctx) => runBridgeTool("transport_stop", "transport.stop", input, ctx),
});
