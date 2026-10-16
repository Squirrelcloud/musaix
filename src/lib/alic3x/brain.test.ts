import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_STEPS,
  runBrain,
  type BrainDeps,
  type LlmClient,
  type LlmToolCall,
} from "./brain.server.ts";
import { createBridge, createLlm, createMemoryStore } from "./adapters.server.ts";
import { askBrain, secretMatches, SessionError, startSession } from "./service.server.ts";
import { toolSpecsForMode, toolsForMode } from "./tools.ts";

let n = 0;
const call = (name: string, args: unknown): LlmToolCall => ({
  id: `call_${++n}`,
  type: "function",
  function: { name, arguments: typeof args === "string" ? args : JSON.stringify(args) },
});

/** Scripted model: returns each response in turn, recording what it was sent. */
function scriptedLlm(responses: { content?: string; toolCalls?: LlmToolCall[] }[]) {
  const seen: Parameters<LlmClient["complete"]>[0][] = [];
  const llm: LlmClient = {
    async complete(input) {
      seen.push(structuredClone(input));
      const r = responses.shift() ?? { content: "ok" };
      return { content: r.content ?? null, toolCalls: r.toolCalls ?? [] };
    },
  };
  return { llm, seen };
}

function setup(
  responses: Parameters<typeof scriptedLlm>[0],
  bridgeImpl?: BrainDeps["bridge"]["execute"],
) {
  const sent: { command: string; args: Record<string, unknown> }[] = [];
  const { llm, seen } = scriptedLlm(responses);
  const store = createMemoryStore();
  const deps: BrainDeps = {
    llm,
    store,
    bridge: {
      async execute(command, args) {
        sent.push({ command, args });
        return bridgeImpl ? bridgeImpl(command, args) : { ok: true };
      },
    },
  };
  return { deps, sent, seen, store };
}

const input = {
  sessionId: "s1",
  userId: "u1",
  mode: "produce" as const,
  text: "tempo 92 and play",
  channel: "text" as const,
};

describe("runBrain", () => {
  it("executes validated tool calls in order against the bridge", async () => {
    const { deps, sent, store } = setup([
      { toolCalls: [call("set_tempo", { bpm: 92 }), call("transport_play", {})] },
      { content: "Tempo's 92, rolling." },
    ]);
    const res = await runBrain(input, deps);
    assert.equal(res.reply, "Tempo's 92, rolling.");
    assert.deepEqual(sent, [
      { command: "transport.set_tempo", args: { bpm: 92 } },
      { command: "transport.play", args: {} },
    ]);
    assert.equal(res.toolEvents.length, 2);
    assert.ok(res.toolEvents.every((e) => e.ok));
    assert.equal((await store.toolCalls("s1", 10)).length, 2);
    assert.deepEqual(
      (await store.recentTurns("s1", 10)).map((t) => t.role),
      ["user", "agent"],
    );
  });

  it("rejects invalid args without touching the bridge, and reports the error to the model", async () => {
    const { deps, sent, seen } = setup([
      { toolCalls: [call("set_tempo", { bpm: 5000 }), call("set_tempo", "{not json")] },
      { content: "That tempo is out of range." },
    ]);
    const res = await runBrain(input, deps);
    assert.equal(sent.length, 0);
    assert.deepEqual(
      res.toolEvents.map((e) => e.ok),
      [false, false],
    );
    assert.match(res.toolEvents[1].error!, /not valid JSON/);
    const toolMsgs = seen[1].messages.filter((m) => m.role === "tool");
    assert.equal(toolMsgs.length, 2);
    assert.match(toolMsgs[0].content, /"ok":false/);
  });

  it("refuses tools outside the current mode and unknown tools", async () => {
    const { deps, sent } = setup([
      { toolCalls: [call("transport_play", {}), call("rm_rf", {})] },
      { content: "Chat mode can't drive Ableton." },
    ]);
    const res = await runBrain({ ...input, mode: "chat" }, deps);
    assert.equal(sent.length, 0);
    assert.match(res.toolEvents[0].error!, /not available in chat mode/);
    assert.match(res.toolEvents[1].error!, /Unknown tool/);
  });

  it("surfaces bridge failures as failed tool events instead of throwing", async () => {
    const { deps } = setup(
      [{ toolCalls: [call("transport_stop", {})] }, { content: "Bridge is down." }],
      async () => {
        throw new Error("connect ECONNREFUSED");
      },
    );
    const res = await runBrain(input, deps);
    assert.equal(res.toolEvents[0].ok, false);
    assert.match(res.toolEvents[0].error!, /ECONNREFUSED/);
    assert.equal(res.reply, "Bridge is down.");
  });

  it("stops after MAX_STEPS model round trips", async () => {
    const loops = Array.from({ length: MAX_STEPS + 3 }, () => ({
      toolCalls: [call("get_live_state", {})],
    }));
    const { deps, sent } = setup(loops);
    const res = await runBrain(input, deps);
    assert.equal(sent.length, MAX_STEPS);
    assert.match(res.reply, /step limit/);
  });

  it("handles remember + memories in-brain and feeds memory into the next prompt", async () => {
    const { deps, sent, seen } = setup([
      { toolCalls: [call("remember", { content: "Sterling masters to -9 LUFS" })] },
      { content: "Noted." },
      { content: "Sure." },
    ]);
    await runBrain(input, deps);
    await runBrain({ ...input, text: "what's my loudness target?" }, deps);
    assert.equal(sent.length, 0);
    assert.match(seen[2].messages[0].content as string, /-9 LUFS/);
  });
});

describe("tool registry", () => {
  it("panic is available in every mode; chat has no transport", () => {
    for (const m of ["produce", "mix", "perform", "chat"] as const)
      assert.ok(toolsForMode(m).includes("panic"));
    assert.ok(!toolsForMode("chat").includes("transport_play"));
  });
  it("emits OpenAI-style JSON schema without $schema", () => {
    const spec = toolSpecsForMode("mix").find((t) => t.function.name === "set_track_volume")!;
    assert.equal((spec.function.parameters as { type: string }).type, "object");
    assert.ok(!("$schema" in spec.function.parameters));
  });
});

describe("adapters", () => {
  it("LLM prefers AI Gateway over OpenRouter and sends tools", async () => {
    let url = "";
    let body: any;
    const llm = createLlm({ AI_GATEWAY_API_KEY: "g", OPENROUTER_API_KEY: "o" }, (async (
      u: string,
      init: RequestInit,
    ) => {
      url = u;
      body = JSON.parse(init.body as string);
      return Response.json({ choices: [{ message: { content: "hi" } }] });
    }) as typeof fetch);
    const res = await llm.complete({
      messages: [{ role: "user", content: "x" }],
      tools: toolSpecsForMode("perform"),
    });
    assert.equal(url, "https://ai-gateway.vercel.sh/v1/chat/completions");
    assert.ok(body.tools.length > 0);
    assert.equal(res.content, "hi");
  });
  it("LLM throws a clear error with no provider", async () => {
    await assert.rejects(
      createLlm({}).complete({ messages: [], tools: [] }),
      /AI_GATEWAY_API_KEY or OPENROUTER_API_KEY/,
    );
  });
  it("bridge posts the command envelope with the token", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const bridge = createBridge(
      { OSC_BRIDGE_URL: "http://b:8765/", OSC_BRIDGE_TOKEN: "t" },
      (async (url: string, init: RequestInit) => {
        seen = { url, init };
        return Response.json({ ok: true });
      }) as typeof fetch,
    );
    await bridge.execute("scene.fire", { scene: 2 });
    assert.equal(seen!.url, "http://b:8765/commands");
    assert.deepEqual(JSON.parse(seen!.init.body as string), {
      type: "scene.fire",
      args: { scene: 2 },
    });
    assert.equal((seen!.init.headers as Record<string, string>)["x-bridge-token"], "t");
  });
  it("bridge without a URL fails clearly", async () => {
    await assert.rejects(createBridge({}).execute("transport.play", {}), /OSC_BRIDGE_URL/);
  });
  it("secretMatches is strict", () => {
    assert.ok(secretMatches("abc", "abc"));
    assert.ok(!secretMatches("abd", "abc"));
    assert.ok(!secretMatches(null, "abc"));
    assert.ok(!secretMatches("abc", undefined));
  });
});

describe("sessions", () => {
  it("only the owner (or an owner-less voice webhook call) can use a server-minted session", async () => {
    const { deps } = setup([{ content: "a" }, { content: "b" }]);
    const id = await startSession("u1", "mix", deps);
    const asOwner = await askBrain(
      { sessionId: id, userId: "u1", mode: "mix", text: "hi", channel: "text" },
      deps,
    );
    assert.equal(asOwner.reply, "a");
    const viaWebhook = await askBrain(
      { sessionId: id, mode: "mix", text: "hi", channel: "voice" },
      deps,
    );
    assert.equal(viaWebhook.reply, "b");
    await assert.rejects(
      askBrain(
        { sessionId: id, userId: "intruder", mode: "mix", text: "hi", channel: "text" },
        deps,
      ),
      SessionError,
    );
    await assert.rejects(
      askBrain(
        {
          sessionId: "00000000-0000-4000-8000-000000000000",
          mode: "mix",
          text: "hi",
          channel: "voice",
        },
        deps,
      ),
      SessionError,
    );
  });
});
