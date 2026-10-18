import { getSql } from "@/lib/db";
import type { ToolName } from "./tools";

/**
 * Postgres-backed command queue between the tool brain and the local bridge.
 *
 * Why a queue and not a socket: the app runs on Vercel functions, which cannot
 * hold an inbound WebSocket, and the bridge sits behind NAT next to Ableton. So
 * the bridge dials out and long-polls `/api/bridge/poll`; any function instance
 * can enqueue, and the database is the rendezvous point.
 */

export type CommandStatus = "queued" | "claimed" | "done" | "failed" | "expired";

export interface ClaimedCommand {
  id: string;
  tool: ToolName;
  args: Record<string, unknown>;
  expires_at: string;
}

export interface CommandRow {
  id: string;
  tool: string;
  status: CommandStatus;
  result: unknown;
  error: string | null;
}

const POLL_INTERVAL_MS = 150;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll `fn` until it returns non-null or `timeoutMs` elapses. */
export async function waitFor<T>(
  fn: () => Promise<T | null>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value !== null) return value;
    if (Date.now() >= deadline || signal?.aborted) return null;
    await sleep(Math.min(POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())));
  }
}

export async function enqueue(
  tool: ToolName,
  args: Record<string, unknown>,
  ttlMs: number,
): Promise<string> {
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    insert into bridge_commands (tool, args, expires_at)
    values (${tool}, ${JSON.stringify(args)}::jsonb, now() + ${ttlMs}::int * interval '1 millisecond')
    returning id`;
  return rows[0].id;
}

export async function getCommand(id: string): Promise<CommandRow | null> {
  const sql = await getSql();
  const rows = await sql<CommandRow>`
    select id, tool, status, result, error from bridge_commands where id = ${id}`;
  return rows[0] ?? null;
}

/** Expire a command that is still queued (never claimed) — it must not fire late. */
export async function expireIfQueued(id: string): Promise<void> {
  const sql = await getSql();
  await sql`update bridge_commands set status = 'expired', finished_at = now()
            where id = ${id} and status = 'queued'`;
}

/** Atomically claim the oldest live command for this bridge, or null. */
export async function claimNext(bridgeId: string): Promise<ClaimedCommand | null> {
  const sql = await getSql();
  await sql`update bridge_commands set status = 'expired', finished_at = now()
            where status = 'queued' and expires_at <= now()`;
  const rows = await sql<ClaimedCommand>`
    update bridge_commands
       set status = 'claimed', claimed_at = now(), bridge_id = ${bridgeId}
     where id = (
       select id from bridge_commands
        where status = 'queued' and expires_at > now()
        order by created_at
        limit 1
        for update skip locked)
    returning id, tool, args, expires_at`;
  return rows[0] ?? null;
}

/** Record a bridge result. Returns false if the command was not claimed. */
export async function completeCommand(
  id: string,
  ok: boolean,
  result: unknown,
  error: string | null,
): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    update bridge_commands
       set status = ${ok ? "done" : "failed"},
           result = ${result === undefined ? null : JSON.stringify(result)}::jsonb,
           error = ${error},
           finished_at = now()
     where id = ${id} and status = 'claimed'
    returning id`;
  return rows.length > 0;
}

export async function heartbeat(bridgeId: string, liveState: unknown): Promise<void> {
  const sql = await getSql();
  const state = liveState === undefined ? null : JSON.stringify(liveState);
  await sql`
    insert into bridge_heartbeats (bridge_id, live_state, last_seen_at)
    values (${bridgeId}, ${state}::jsonb, now())
    on conflict (bridge_id) do update
      set live_state = coalesce(excluded.live_state, bridge_heartbeats.live_state),
          last_seen_at = now()`;
}

export async function bridgeStatus() {
  const sql = await getSql();
  return sql<{ bridge_id: string; live_state: unknown; last_seen_at: string; online: boolean }>`
    select bridge_id, live_state, last_seen_at,
           last_seen_at > now() - interval '45 seconds' as online
      from bridge_heartbeats
     order by last_seen_at desc`;
}
