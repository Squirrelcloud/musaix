import { createFileRoute } from "@tanstack/react-router";

/**
 * ElevenLabs → Tool Brain. Configure the ElevenLabs agent with ONE server tool
 * (webhook, POST) pointing here — see docs/ALIC3X.md. The agent is just the
 * voice: it forwards what Sterling said and speaks back `reply`.
 *
 * Auth: shared secret in `x-alic3x-secret` (ELEVENLABS_TOOL_SECRET). The user
 * comes from the server-minted session, never from the request body.
 */
export const Route = createFileRoute("/api/alic3x/elevenlabs-tool")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { askBrain, parseMode, secretMatches, SessionError } =
          await import("@/lib/alic3x/service.server");
        if (
          !secretMatches(
            request.headers.get("x-alic3x-secret"),
            process.env.ELEVENLABS_TOOL_SECRET?.trim(),
          )
        ) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        const body = (await request.json().catch(() => null)) as {
          utterance?: unknown;
          session_id?: unknown;
          mode?: unknown;
        } | null;
        const text = typeof body?.utterance === "string" ? body.utterance.trim() : "";
        const sessionId = typeof body?.session_id === "string" ? body.session_id : "";
        if (!text || !sessionId) {
          return Response.json({ error: "utterance and session_id are required" }, { status: 400 });
        }
        try {
          const { reply, toolEvents } = await askBrain({
            sessionId,
            mode: parseMode(body?.mode),
            text: text.slice(0, 4000),
            channel: "voice",
          });
          return Response.json({ reply, tool_events: toolEvents });
        } catch (err) {
          if (err instanceof SessionError)
            return Response.json({ error: err.message }, { status: 404 });
          console.error("[alic3x] elevenlabs-tool:", err);
          // Still give the voice agent something speakable.
          return Response.json(
            { reply: "My brain link dropped — try that again in a second." },
            { status: 502 },
          );
        }
      },
    },
  },
});
