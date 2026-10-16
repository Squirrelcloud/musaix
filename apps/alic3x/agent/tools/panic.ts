import { defineTool } from "eve/tools";
import { z } from "zod";
import { runBridgeTool } from "../lib/bridge";

export default defineTool({
  description:
    "Emergency stop: halt transport, stop all clips, flush the bridge queue. Use immediately if Sterling says stop, panic or kill it.",
  inputSchema: z.object({}),
  label: { start: () => "PANIC — stop everything" },
  execute: (input, ctx) => runBridgeTool("panic", "panic.stop_all", input, ctx),
});
