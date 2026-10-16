import { defineTool } from "eve/tools";
import { z } from "zod";
import { runBridgeTool } from "../lib/bridge";

export default defineTool({
  description: "Launch a scene by zero-based index.",
  inputSchema: z.object({ scene: z.number().int().min(0) }),
  label: { start: (input) => `Launch scene ${input.scene + 1}` },
  execute: (input, ctx) => runBridgeTool("fire_scene", "scene.fire", input, ctx),
});
