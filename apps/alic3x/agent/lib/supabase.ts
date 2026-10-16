import { env } from "./env";

/**
 * Supabase via PostgREST with the service-role key (server-only). Holds what
 * should outlive an eve session: long-term memory, the knowledge base, and a
 * tool-call log. eve itself owns sessions and transcripts.
 *
 * Every call is a no-op (or empty) when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 * are unset, so the agent still runs locally without a database.
 */

function client() {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  const rest = `${url.replace(/\/+$/, "")}/rest/v1`;
  return async <T>(path: string, init: RequestInit = {}, prefer?: string): Promise<T> => {
    const res = await fetch(`${rest}${path}`, {
      ...init,
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        ...(prefer ? { prefer } : {}),
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return (
      res.status === 204 || res.headers.get("content-length") === "0" ? null : await res.json()
    ) as T;
  };
}

export function supabaseConfigured(): boolean {
  return client() !== null;
}

export async function memories(userId: string, limit = 20): Promise<string[]> {
  const req = client();
  if (!req) return [];
  const rows = await req<{ content: string }[]>(
    `/alic3x_memories?user_id=eq.${encodeURIComponent(userId)}&select=content&order=created_at.desc&limit=${limit}`,
  );
  return rows.map((r) => r.content).reverse();
}

export async function remember(userId: string, content: string): Promise<void> {
  const req = client();
  if (!req)
    throw new Error("Long-term memory needs Supabase (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).");
  await req(
    "/alic3x_memories",
    { method: "POST", body: JSON.stringify({ user_id: userId, content }) },
    "return=minimal",
  );
}

export async function searchKnowledge(
  query: string,
  limit = 5,
): Promise<{ title: string; content: string }[]> {
  const req = client();
  if (!req) return [];
  return req("/rpc/alic3x_search_kb", {
    method: "POST",
    body: JSON.stringify({ q: query, match_count: limit }),
  });
}

export async function logToolCall(entry: {
  sessionId: string;
  tool: string;
  args: unknown;
  ok: boolean;
  result?: unknown;
  error?: string;
  ms: number;
}): Promise<void> {
  const req = client();
  if (!req) return;
  try {
    await req(
      "/alic3x_tool_calls",
      {
        method: "POST",
        body: JSON.stringify({
          session_id: entry.sessionId,
          tool: entry.tool,
          args: entry.args ?? null,
          ok: entry.ok,
          result: entry.result ?? null,
          error: entry.error ?? null,
          duration_ms: entry.ms,
        }),
      },
      "return=minimal",
    );
  } catch (err) {
    console.error("[alic3x] tool log failed:", err);
  }
}
