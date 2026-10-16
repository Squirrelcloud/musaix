import {
  TOOLS,
  isToolName,
  toolSpecsForMode,
  toolsForMode,
  type Json,
  type Mode,
  type ToolEvent,
} from "./tools.ts";

/**
 * Musaix Tool Brain — the reasoning loop behind Alic3X.
 *
 * ElevenLabs is only the voice; every utterance (spoken via the ElevenLabs
 * server tool, or typed in the console) lands here. One turn:
 *   1. load memory + recent transcript + knowledge-base hits (Supabase)
 *   2. ask the model (AI Gateway / OpenRouter) with the mode's tool set
 *   3. validate and execute tool calls (FastAPI OSC bridge or in-brain), loop
 *   4. persist the turn and every tool call, return reply + tool events
 *
 * Pure orchestration: the model, bridge and store are injected so the loop is
 * testable without network (see brain.test.ts).
 */

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: LlmToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type LlmToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export interface LlmClient {
  complete(input: {
    messages: ChatMessage[];
    tools: ReturnType<typeof toolSpecsForMode>;
  }): Promise<{ content: string | null; toolCalls: LlmToolCall[] }>;
}

export interface Bridge {
  execute(command: string, args: Record<string, unknown>): Promise<Json>;
}

export interface Store {
  ensureSession(sessionId: string, userId: string, mode: Mode): Promise<void>;
  /** Owner of a server-minted session, or null if it doesn't exist. */
  sessionOwner(sessionId: string): Promise<string | null>;
  recentTurns(
    sessionId: string,
    limit: number,
  ): Promise<{ role: "user" | "agent"; text: string }[]>;
  appendTurn(sessionId: string, role: "user" | "agent", text: string): Promise<void>;
  logToolCall(sessionId: string, event: ToolEvent): Promise<void>;
  /** Most recent tool calls for a session, oldest first. */
  toolCalls(sessionId: string, limit: number): Promise<ToolEvent[]>;
  memories(userId: string, limit: number): Promise<string[]>;
  remember(userId: string, content: string): Promise<void>;
  searchKnowledge(query: string, limit: number): Promise<{ title: string; content: string }[]>;
}

export type BrainDeps = { llm: LlmClient; bridge: Bridge; store: Store; now?: () => number };

export type BrainInput = {
  sessionId: string;
  userId: string;
  mode: Mode;
  text: string;
  /** "voice" turns get shorter, speakable replies. */
  channel: "voice" | "text";
};

export type BrainResult = { reply: string; toolEvents: ToolEvent[] };

/** Hard ceiling on model↔tool round trips per turn (keeps a runaway loop off the transport). */
export const MAX_STEPS = 6;

const MODE_PROMPTS: Record<Mode, string> = {
  produce:
    "Mode: PRODUCE. Help build the track — arrangement, scenes, tempo, sound choices. Act on clear instructions; confirm before anything destructive.",
  mix: "Mode: MIX. Work on balance: volumes, mutes, solos, device parameters. Prefer small moves and say what you changed.",
  perform:
    "Mode: PERFORM. Sterling is live. Execute transport/scene commands immediately with minimal talk.",
  chat: "Mode: CHAT. Creative conversation only. You have no Ableton control in this mode; say so if asked to change the set.",
};

export function systemPrompt(input: {
  mode: Mode;
  channel: BrainInput["channel"];
  memories: string[];
  knowledge: { title: string; content: string }[];
}): string {
  const parts = [
    "You are Alic3X, the studio co-pilot inside Musaix Pro, working with Sterling in Ableton Live 12.",
    "You control Ableton only through the provided tools. Never claim an action happened unless its tool result says ok.",
    "If Sterling says stop, panic, or kill it — call `panic` first, talk after.",
    MODE_PROMPTS[input.mode],
    input.channel === "voice"
      ? "Replies are spoken aloud: one or two short sentences, no markdown, no lists."
      : "Replies are shown as text: concise, plain language.",
  ];
  if (input.memories.length) {
    parts.push(
      "What you remember about Sterling and the project:\n- " + input.memories.join("\n- "),
    );
  }
  if (input.knowledge.length) {
    parts.push(
      "Relevant project docs:\n" +
        input.knowledge.map((k) => `## ${k.title}\n${k.content.slice(0, 1200)}`).join("\n\n"),
    );
  }
  return parts.join("\n\n");
}

function safeJson(raw: string): Json | undefined {
  try {
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return undefined;
  }
}

async function runTool(
  call: LlmToolCall,
  ctx: { input: BrainInput; deps: BrainDeps; allowed: Set<string> },
): Promise<ToolEvent> {
  const now = ctx.deps.now ?? Date.now;
  const started = now();
  const name = call.function.name;
  const rawArgs = safeJson(call.function.arguments);
  const base = {
    id: call.id,
    tool: name,
    args: rawArgs ?? call.function.arguments,
    at: new Date(started).toISOString(),
  };
  const fail = (error: string): ToolEvent => ({ ...base, ok: false, error, ms: now() - started });

  if (!isToolName(name)) return fail(`Unknown tool "${name}"`);
  if (!ctx.allowed.has(name))
    return fail(`Tool "${name}" is not available in ${ctx.input.mode} mode`);
  if (rawArgs === undefined) return fail("Arguments were not valid JSON");

  const def = TOOLS[name];
  const parsed = def.schema.safeParse(rawArgs);
  if (!parsed.success)
    return fail(`Invalid arguments: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
  const args = parsed.data as Record<string, Json>;

  try {
    let result: Json | undefined;
    if (def.target === "bridge") {
      result = await ctx.deps.bridge.execute(def.command!, args);
    } else if (name === "search_knowledge") {
      result = await ctx.deps.store.searchKnowledge(String(args.query), 5);
    } else if (name === "remember") {
      await ctx.deps.store.remember(ctx.input.userId, String(args.content));
      result = { saved: true };
    }
    return { ...base, args, ok: true, result, ms: now() - started };
  } catch (err) {
    return { ...fail(err instanceof Error ? err.message : String(err)), args };
  }
}

export async function runBrain(input: BrainInput, deps: BrainDeps): Promise<BrainResult> {
  const { store, llm } = deps;
  await store.ensureSession(input.sessionId, input.userId, input.mode);

  const [history, memories, knowledge] = await Promise.all([
    store.recentTurns(input.sessionId, 20),
    store.memories(input.userId, 20),
    store.searchKnowledge(input.text, 3).catch(() => []),
  ]);
  await store.appendTurn(input.sessionId, "user", input.text);

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt({ mode: input.mode, channel: input.channel, memories, knowledge }),
    },
    ...history.map((t): ChatMessage =>
      t.role === "user"
        ? { role: "user", content: t.text }
        : { role: "assistant", content: t.text },
    ),
    { role: "user", content: input.text },
  ];

  const allowed = new Set<string>(toolsForMode(input.mode));
  const tools = toolSpecsForMode(input.mode);
  const toolEvents: ToolEvent[] = [];
  let reply = "";

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await llm.complete({ messages, tools });
    if (!res.toolCalls.length) {
      reply = res.content?.trim() ?? "";
      break;
    }
    messages.push({ role: "assistant", content: res.content, tool_calls: res.toolCalls });
    // Sequential on purpose: Ableton commands are order-sensitive (stop → set tempo → play).
    for (const call of res.toolCalls) {
      const event = await runTool(call, { input, deps, allowed });
      toolEvents.push(event);
      await store.logToolCall(input.sessionId, event);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(
          event.ok ? { ok: true, result: event.result ?? null } : { ok: false, error: event.error },
        ),
      });
    }
  }

  if (!reply) {
    reply = toolEvents.length
      ? `Done — ran ${toolEvents.length} step${toolEvents.length === 1 ? "" : "s"}, but I hit my step limit before summarising.`
      : "I didn't catch that — say it again?";
  }
  await store.appendTurn(input.sessionId, "agent", reply);
  return { reply, toolEvents };
}
