import { it } from "node:test";
import assert from "node:assert/strict";
import { chatProvider, selectModel, DEFAULT_MODEL } from "./model.ts";

it("defaults to AI Gateway and passes the slug through", () => {
  assert.equal(chatProvider({}), "gateway");
  assert.equal(selectModel({}), DEFAULT_MODEL);
  assert.equal(selectModel({ ALIC3X_MODEL: "openai/gpt-5.4" }), "openai/gpt-5.4");
  assert.equal(chatProvider({ AI_GATEWAY_API_KEY: "g", OPENROUTER_API_KEY: "o" }), "gateway");
});

it("uses OpenRouter when asked or when it's the only key", () => {
  assert.equal(chatProvider({ CHAT_PROVIDER: "openrouter" }), "openrouter");
  assert.equal(chatProvider({ CHAT_PROVIDER: " OpenRouter " }), "openrouter");
  assert.equal(chatProvider({ OPENROUTER_API_KEY: "o" }), "openrouter");
  assert.equal(chatProvider({ CHAT_PROVIDER: "gateway", OPENROUTER_API_KEY: "o" }), "gateway");
  const model = selectModel({ CHAT_PROVIDER: "openrouter", OPENROUTER_API_KEY: "o" });
  assert.equal(typeof model, "object");
  assert.equal((model as { modelId: string }).modelId, DEFAULT_MODEL);
});
