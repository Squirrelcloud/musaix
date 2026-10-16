import { it } from "node:test";
import assert from "node:assert/strict";
import { MODES, parseMode, toolAllowed } from "./modes.ts";

it("panic works everywhere; chat has no Ableton control", () => {
  for (const m of MODES) assert.ok(toolAllowed("panic", m));
  assert.ok(!toolAllowed("transport_play", "chat"));
  assert.ok(!toolAllowed("set_tempo", "mix"));
  assert.ok(toolAllowed("set_device_parameter", "mix"));
  assert.ok(toolAllowed("search_knowledge", "chat"));
});

it("unknown modes fall back to produce", () => {
  assert.equal(parseMode("perform"), "perform");
  assert.equal(parseMode("root"), "produce");
  assert.equal(parseMode(null), "produce");
});
