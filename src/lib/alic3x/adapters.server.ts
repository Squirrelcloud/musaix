import type { Bridge, LlmClient, LlmToolCall, Store } from "./brain.server.ts";
import type { Json, Mode, ToolEvent } from "./tools.ts";

/**
 * Production adapters for the Tool Brain, configured from env:
 *
 *   Model:     AI_GATEWAY_API_KEY (Vercel AI Gateway) or OPENROUTER_API_KEY; ALIC3X_MODEL.
 *              ALIC3X_LLM_BASE_URL points at any other OpenAI-compatible endpoint.
 *   Bridge:    OSC_BRIDGE_URL (+ OSC_BRIDGE_TOKEN) — the FastAPI bridge in /bridge
 *   Supabase:  SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (server-only key)
 *
 * Anything unset degrades loudly rather than silently: no model key throws, no
 * bridge URL makes bridge tools fail with a clear error, no Supabase falls back
 * to an in-process store (dev only — lost on restart).
 */

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;

const env = (e: Env, key: string) => (e[key]?.trim() ? e[key]!.trim() : undefined);

export const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";

export function createLlm(e: Env = process.env, f: Fetch = fetch): LlmClient {
  const gatewayKey = env(e, "AI_GATEWAY_API_KEY");
  const openrouterKey = env(e, "OPENROUTER_API_KEY");
  const customBase = env(e, "ALIC3X_LLM_BASE_URL")?.replace(/\/+$/, "");
  const provider = customBase
    ? { base: customBase, key: gatewayKey ?? openrouterKey ?? "none" }
    : gatewayKey
      ? { base: "https://ai-gateway.vercel.sh/v1", key: gatewayKey }
      : openrouterKey
        ? { base: "https://openrouter.ai/api/v1", key: openrouterKey }
        : null;
  const model = env(e, "ALIC3X_MODEL") ?? DEFAULT_MODEL;

  return {
    async complete({ messages, tools }) {
      if (!provider)
        throw new Error(
          "No model provider configured: set AI_GATEWAY_API_KEY or OPENROUTER_API_KEY",
        );
      const res = await f(`${provider.base}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${provider.key}`,
          "content-type": "application/json",
          "x-title": "Musaix Alic3X",
        },
        body: JSON.stringify({
          model,
          messages,
          tools: tools.length ? tools : undefined,
          temperature: 0.4,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok)
        throw new Error(
          `Model request failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
        );
      const data = (await res.json()) as {
        choices?: { message?: { content?: string | null; tool_calls?: LlmToolCall[] } }[];
      };
      const msg = data.choices?.[0]?.message;
      return { content: msg?.content ?? null, toolCalls: msg?.tool_calls ?? [] };
    },
  };
}

export function createBridge(
  e: Env = process.env,
  f: Fetch = fetch,
): Bridge & { status(): Promise<Json> } {
  const base = env(e, "OSC_BRIDGE_URL")?.replace(/\/+$/, "");
  const headers: Record<string, string> = { "content-type": "application/json" };
  const token = env(e, "OSC_BRIDGE_TOKEN");
  if (token) headers["x-bridge-token"] = token;

  const call = async (path: string, init?: RequestInit) => {
    if (!base) throw new Error("OSC bridge not configured (OSC_BRIDGE_URL)");
    const res = await f(`${base}${path}`, { ...init, headers, signal: AbortSignal.timeout(8_000) });
    const body = (await res.json().catch(() => ({}))) as { [key: string]: Json };
    if (!res.ok) throw new Error(`Bridge ${res.status}: ${JSON.stringify(body.detail ?? body)}`);
    return body;
  };

  return {
    execute: (command, args) =>
      call("/commands", { method: "POST", body: JSON.stringify({ type: command, args }) }),
    status: () => call("/status"),
  };
}

/** Supabase via PostgREST — no SDK needed server-side. Tables: supabase/migrations. */
export function createSupabaseStore(url: string, serviceKey: string, f: Fetch = fetch): Store {
  const rest = `${url.replace(/\/+$/, "")}/rest/v1`;
  const headers = {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    "content-type": "application/json",
  };
  const req = async <T>(path: string, init: RequestInit = {}, prefer?: string): Promise<T> => {
    const res = await f(`${rest}${path}`, {
      ...init,
      headers: prefer ? { ...headers, prefer } : headers,
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return (
      res.status === 204 || res.headers.get("content-length") === "0" ? null : await res.json()
    ) as T;
  };
  const q = encodeURIComponent;

  return {
    async ensureSession(sessionId, userId, mode) {
      await req(
        "/alic3x_sessions?on_conflict=id",
        { method: "POST", body: JSON.stringify({ id: sessionId, user_id: userId, mode }) },
        "resolution=merge-duplicates,return=minimal",
      );
    },
    async sessionOwner(sessionId) {
      const rows = await req<{ user_id: string }[]>(
        `/alic3x_sessions?id=eq.${q(sessionId)}&select=user_id&limit=1`,
      );
      return rows[0]?.user_id ?? null;
    },
    async recentTurns(sessionId, limit) {
      const rows = await req<{ role: "user" | "agent"; text: string }[]>(
        `/alic3x_turns?session_id=eq.${q(sessionId)}&select=role,text&order=created_at.desc&limit=${limit}`,
      );
      return rows.reverse();
    },
    async appendTurn(sessionId, role, text) {
      await req(
        "/alic3x_turns",
        { method: "POST", body: JSON.stringify({ session_id: sessionId, role, text }) },
        "return=minimal",
      );
    },
    async logToolCall(sessionId, ev: ToolEvent) {
      await req(
        "/alic3x_tool_calls",
        {
          method: "POST",
          body: JSON.stringify({
            session_id: sessionId,
            call_id: ev.id,
            tool: ev.tool,
            args: ev.args ?? null,
            ok: ev.ok,
            result: ev.result ?? null,
            error: ev.error ?? null,
            duration_ms: ev.ms,
          }),
        },
        "return=minimal",
      );
    },
    async toolCalls(sessionId, limit) {
      const rows = await req<
        {
          call_id: string;
          tool: string;
          args: Json;
          ok: boolean;
          result: Json;
          error: string | null;
          duration_ms: number;
          created_at: string;
        }[]
      >(
        `/alic3x_tool_calls?session_id=eq.${q(sessionId)}&select=call_id,tool,args,ok,result,error,duration_ms,created_at&order=created_at.desc&limit=${limit}`,
      );
      return rows.reverse().map((r) => ({
        id: r.call_id,
        tool: r.tool,
        args: r.args,
        ok: r.ok,
        result: r.result ?? undefined,
        error: r.error ?? undefined,
        ms: r.duration_ms,
        at: r.created_at,
      }));
    },
    async memories(userId, limit) {
      const rows = await req<{ content: string }[]>(
        `/alic3x_memories?user_id=eq.${q(userId)}&select=content&order=created_at.desc&limit=${limit}`,
      );
      return rows.map((r) => r.content);
    },
    async remember(userId, content) {
      await req(
        "/alic3x_memories",
        { method: "POST", body: JSON.stringify({ user_id: userId, content }) },
        "return=minimal",
      );
    },
    async searchKnowledge(query, limit) {
      return req<{ title: string; content: string }[]>("/rpc/alic3x_search_kb", {
        method: "POST",
        body: JSON.stringify({ q: query, match_count: limit }),
      });
    },
  };
}

/** Dev fallback when Supabase isn't configured. Process-local; wiped on restart. */
export function createMemoryStore(): Store {
  const turns = new Map<string, { role: "user" | "agent"; text: string }[]>();
  const mems = new Map<string, string[]>();
  const sessions = new Map<string, { userId: string; mode: Mode }>();
  const calls = new Map<string, ToolEvent[]>();
  return {
    async ensureSession(id, userId, mode) {
      sessions.set(id, { userId, mode });
    },
    async sessionOwner(id) {
      return sessions.get(id)?.userId ?? null;
    },
    async recentTurns(id, limit) {
      return (turns.get(id) ?? []).slice(-limit);
    },
    async appendTurn(id, role, text) {
      turns.set(id, [...(turns.get(id) ?? []), { role, text }]);
    },
    async logToolCall(id, ev) {
      calls.set(id, [...(calls.get(id) ?? []), ev].slice(-200));
    },
    async toolCalls(id, limit) {
      return (calls.get(id) ?? []).slice(-limit);
    },
    async memories(userId, limit) {
      return (mems.get(userId) ?? []).slice(-limit);
    },
    async remember(userId, content) {
      mems.set(userId, [...(mems.get(userId) ?? []), content]);
    },
    async searchKnowledge() {
      return [];
    },
  };
}

const g = globalThis as typeof globalThis & { __alic3xMemoryStore__?: Store };

export function createStore(e: Env = process.env, f: Fetch = fetch): Store {
  const url = env(e, "SUPABASE_URL");
  const key = env(e, "SUPABASE_SERVICE_ROLE_KEY");
  if (url && key) return createSupabaseStore(url, key, f);
  return (g.__alic3xMemoryStore__ ??= createMemoryStore());
}
