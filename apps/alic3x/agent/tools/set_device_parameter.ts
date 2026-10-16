import { defineTool } from "eve/tools";
import { z } from "zod";
import { runBridgeTool } from "../lib/bridge";

export default defineTool({
  description:
    "Set a device parameter on a track (e.g. a plugin knob). Value is normalised 0.0–1.0.",
  inputSchema: z.object({
    track: z.number().int().min(0).describe("Zero-based track index"),
    device: z.number().int().min(0).describe("Zero-based device index on the track"),
    parameter: z.number().int().min(0).describe("Zero-based parameter index"),
    value: z.number().min(0).max(1),
  }),
  label: {
    start: (input) =>
      `Track ${input.track + 1} device ${input.device + 1} param ${input.parameter + 1} → ${input.value}`,
  },
  execute: (input, ctx) =>
    runBridgeTool("set_device_parameter", "device.set_parameter", input, ctx),
});
