import { timingSafeEqual } from "node:crypto";

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

/** eve session IDs are opaque tokens like `wrun_…`; reject anything that isn't. */
export function isSessionId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{4,200}$/.test(value);
}
