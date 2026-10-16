import { Client } from "eve/client";
import { MODE_HEADER, parseMode } from "@/agent/lib/modes";
import { isSessionId, secretMatches } from "@/lib/elevenlabs.server";

export const maxDuration = 60;

/**
 * ElevenLabs → eve. Configure the ElevenLabs agent with ONE server tool
 * (webhook, POST) pointing here — see docs/ALIC3X.md. The voice agent forwards
 * what Sterling said; this route posts it into the console's eve session and
 * returns Alic3X's reply for ElevenLabs to speak. Because it lands in the same
 * session, the console's transcript and tool feed show voice turns live.
 *
 * Auth: ElevenLabs → here with `x-alic3x-secret` (ELEVENLABS_TOOL_SECRET);
 * here → eve with `x-alic3x-internal` (ALIC3X_INTERNAL_SECRET).
 */
export async function POST(request: Request) {
  if (
    !secretMatches(
      request.headers.get("x-alic3x-secret"),
      process.env.ELEVENLABS_TOOL_SECRET?.trim(),
    )
  ) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const internal = process.env.ALIC3X_INTERNAL_SECRET?.trim();
  if (!internal)
    return Response.json({ error: "ALIC3X_INTERNAL_SECRET is not set" }, { status: 500 });

  const body = (await request.json().catch(() => null)) as {
    utterance?: unknown;
    session_id?: unknown;
    mode?: unknown;
  } | null;
  const text = typeof body?.utterance === "string" ? body.utterance.trim().slice(0, 4000) : "";
  if (!text || !isSessionId(body?.session_id)) {
    return Response.json(
      { error: "utterance and a valid session_id are required" },
      { status: 400 },
    );
  }

  const client = new Client({
    host: new URL(request.url).origin,
    headers: { "x-alic3x-internal": internal, [MODE_HEADER]: parseMode(body?.mode) },
    redirect: "manual",
  });
  try {
    const response = await client.sessions
      .attach(body.session_id)
      .send(text, { turnPolicy: "queue" });
    const result = await response.result();
    return Response.json({ reply: result.message ?? "Done." });
  } catch (err) {
    console.error("[alic3x] elevenlabs-tool:", err);
    // Still give the voice agent something speakable.
    return Response.json(
      { reply: "My brain link dropped — try that again in a second." },
      { status: 502 },
    );
  }
}
