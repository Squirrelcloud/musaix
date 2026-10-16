import { randomUUID, timingSafeEqual } from "node:crypto";
import { runBrain, type BrainDeps, type BrainResult } from "./brain.server.ts";
import { createBridge, createLlm, createStore } from "./adapters.server.ts";
import { MODES, type Mode } from "./tools.ts";

/**
 * Entry points shared by the console API routes and the ElevenLabs
 * webhook. Sessions are always minted here, so a session id maps to exactly
 * one owner and neither caller can act on someone else's session.
 */

export function brainDeps(): BrainDeps {
  return { llm: createLlm(), bridge: createBridge(), store: createStore() };
}

export function parseMode(value: unknown): Mode {
  return MODES.includes(value as Mode) ? (value as Mode) : "produce";
}

export async function startSession(
  userId: string,
  mode: Mode,
  deps = brainDeps(),
): Promise<string> {
  const sessionId = randomUUID();
  await deps.store.ensureSession(sessionId, userId, mode);
  return sessionId;
}

export class SessionError extends Error {
  readonly status = 404;
}

export async function askBrain(
  input: {
    sessionId: string;
    userId?: string;
    mode: Mode;
    text: string;
    channel: "voice" | "text";
  },
  deps = brainDeps(),
): Promise<BrainResult> {
  const owner = await deps.store.sessionOwner(input.sessionId);
  if (!owner || (input.userId && owner !== input.userId)) throw new SessionError("Unknown session");
  return runBrain({ ...input, userId: owner }, deps);
}

/** Signed WebSocket URL so the browser can talk to the ElevenLabs agent without our API key. */
export async function elevenLabsSignedUrl(f: typeof fetch = fetch): Promise<string | null> {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  const agentId = process.env.ELEVENLABS_AGENT_ID?.trim();
  if (!key || !agentId) return null;
  const res = await f(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
    { headers: { "xi-api-key": key }, signal: AbortSignal.timeout(8_000) },
  );
  if (!res.ok) throw new Error(`ElevenLabs signed URL failed (${res.status})`);
  return ((await res.json()) as { signed_url: string }).signed_url;
}

export function secretMatches(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
