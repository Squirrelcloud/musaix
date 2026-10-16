import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Model selection.
 *
 *   CHAT_PROVIDER=gateway (default) → Vercel AI Gateway. On Vercel it
 *     authenticates via OIDC with no key; elsewhere set AI_GATEWAY_API_KEY.
 *   CHAT_PROVIDER=openrouter        → OpenRouter with OPENROUTER_API_KEY.
 *
 * ALIC3X_MODEL picks the model slug (same `provider/model` format on both).
 * ALIC3X_LLM_BASE_URL points the OpenAI-compatible path at any other endpoint
 * (a local model, or a stub in tests).
 */

export const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";

type Env = Record<string, string | undefined>;
const get = (e: Env, k: string) => (e[k]?.trim() ? e[k]!.trim() : undefined);

export function chatProvider(e: Env = process.env): "gateway" | "openrouter" {
  const explicit = get(e, "CHAT_PROVIDER")?.toLowerCase();
  if (explicit === "openrouter" || explicit === "gateway") return explicit;
  if (get(e, "ALIC3X_LLM_BASE_URL")) return "openrouter";
  return get(e, "OPENROUTER_API_KEY") && !get(e, "AI_GATEWAY_API_KEY") ? "openrouter" : "gateway";
}

export function selectModel(e: Env = process.env) {
  const id = get(e, "ALIC3X_MODEL") ?? DEFAULT_MODEL;
  if (chatProvider(e) === "gateway") return id;
  const openrouter = createOpenAICompatible({
    name: "openrouter",
    baseURL: get(e, "ALIC3X_LLM_BASE_URL") ?? "https://openrouter.ai/api/v1",
    apiKey: get(e, "OPENROUTER_API_KEY") ?? "none",
    headers: { "X-Title": "Musaix Alic3X" },
  });
  return openrouter.chatModel(id);
}
