import { defineAgent } from "eve";
import { selectModel } from "./lib/model";

export default defineAgent({
  description: "Alic3X — Musaix Pro studio co-pilot that drives Ableton Live 12.",
  // AI Gateway by default; CHAT_PROVIDER=openrouter for OpenRouter. See lib/model.ts.
  model: selectModel(),
  // Set explicitly so builds don't depend on fetching gateway metadata; match your model.
  modelContextWindowTokens: Number(process.env.ALIC3X_MODEL_CONTEXT_TOKENS) || 200_000,
  // No shell, file or web tools: Alic3X can only do what agent/tools/ allows.
  defaultTools: false,
});
