import { env } from "./env";
import { parseMode, toolAllowed, type Mode } from "./modes";
import { logToolCall } from "./supabase";

/**
 * Client for the FastAPI OSC Bridge (repo `bridge/`): the only path into
 * Ableton. The bridge re-validates every command, rate-limits, and handles
 * panic; this side adds the per-mode allow-list.
 */

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type Fetch = typeof fetch;

export function createBridge(
  e: Record<string, string | undefined> = process.env,
  f: Fetch = fetch,
) {
  const base = e.OSC_BRIDGE_URL?.trim().replace(/\/+$/, "");
  const token = e.OSC_BRIDGE_TOKEN?.trim();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers["x-bridge-token"] = token;

  const call = async (path: string, init?: RequestInit): Promise<Json> => {
    if (!base) throw new Error("OSC bridge not configured (OSC_BRIDGE_URL)");
    const res = await f(`${base}${path}`, { ...init, headers, signal: AbortSignal.timeout(8_000) });
    const body = (await res.json().catch(() => ({}))) as { [key: string]: Json };
    if (!res.ok) throw new Error(`Bridge ${res.status}: ${JSON.stringify(body.detail ?? body)}`);
    return body;
  };

  return {
    execute: (command: string, args: Record<string, unknown>) =>
      call("/commands", { method: "POST", body: JSON.stringify({ type: command, args }) }),
    status: () => call("/status"),
  };
}

/** The bits of eve's tool context this module reads. */
export type ToolCtx = {
  session: {
    id: string;
    auth: { current?: { attributes: Readonly<Record<string, string | readonly string[]>> } | null };
  };
};

export function modeOf(ctx: ToolCtx): Mode {
  return parseMode(ctx.session.auth.current?.attributes.mode);
}

/** Shared body of every Ableton tool: mode check → bridge → best-effort log. */
export async function runBridgeTool(
  tool: string,
  command: string,
  args: Record<string, unknown>,
  ctx: ToolCtx,
): Promise<Json> {
  const mode = modeOf(ctx);
  const started = Date.now();
  if (!toolAllowed(tool, mode)) {
    throw new Error(`"${tool}" is not available in ${mode} mode. Ask Sterling to switch modes.`);
  }
  try {
    const result = await createBridge().execute(command, args);
    void logToolCall({
      sessionId: ctx.session.id,
      tool,
      args,
      ok: true,
      result,
      ms: Date.now() - started,
    });
    return result;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    void logToolCall({
      sessionId: ctx.session.id,
      tool,
      args,
      ok: false,
      error,
      ms: Date.now() - started,
    });
    throw err;
  }
}
