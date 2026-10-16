import { eveChannel, defaultEveAuth } from "eve/channels/eve";
import { localDev, type AuthFn } from "eve/channels/auth";
import { createServerClient } from "@supabase/ssr";
import { emailAllowed } from "../../lib/allowlist";
import { MODE_HEADER, parseMode } from "../lib/modes";
import { env } from "../lib/env";
import { timingSafeEqual } from "node:crypto";

/**
 * Who may talk to Alic3X. Production fails closed: a request is accepted only
 * from a signed-in, allow-listed Supabase user (the console) or from the
 * ElevenLabs webhook carrying the internal secret. `localDev()` admits local
 * `eve dev` traffic and nothing in production.
 *
 * The console mode rides along as a request header and lands in
 * `ctx.session.auth.current.attributes.mode`, where every Ableton tool checks it.
 */

function modeAttr(request: Request) {
  return parseMode(request.headers.get(MODE_HEADER));
}

function cookiesFrom(request: Request) {
  return (request.headers.get("cookie") ?? "")
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const i = c.indexOf("=");
      return { name: c.slice(0, i), value: decodeURIComponent(c.slice(i + 1)) };
    });
}

const supabaseUser: AuthFn<Request> = async (request) => {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const anon = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anon || !request.headers.get("cookie")) return null;
  const supabase = createServerClient(url, anon, {
    cookies: { getAll: () => cookiesFrom(request), setAll: () => {} },
  });
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  if (
    !emailAllowed(
      user.email,
      process.env.ALIC3X_ALLOWED_EMAILS,
      process.env.NODE_ENV === "production",
    )
  ) {
    return null;
  }
  return {
    authenticator: "supabase",
    principalId: user.id,
    principalType: "user",
    attributes: { email: user.email ?? "", mode: modeAttr(request) },
  };
};

const INTERNAL_HEADER = "x-alic3x-internal";

/** The Next.js ElevenLabs webhook forwards voice turns with this shared secret. */
const internalVoice: AuthFn<Request> = (request) => {
  const expected = env("ALIC3X_INTERNAL_SECRET");
  const given = request.headers.get(INTERNAL_HEADER);
  if (!expected || !given) return null;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return {
    authenticator: "alic3x-internal",
    principalId: "elevenlabs-voice",
    principalType: "service",
    attributes: { mode: modeAttr(request) },
  };
};

/** `localDev()` (local `eve dev` only), plus the mode header so local turns obey modes too. */
const devLocal = localDev();
const localDevWithMode: AuthFn<Request> = async (request) => {
  const result = await devLocal(request);
  return result
    ? { ...result, attributes: { ...result.attributes, mode: modeAttr(request) } }
    : result;
};

export default eveChannel({
  auth: [supabaseUser, internalVoice, localDevWithMode],
  onMessage(ctx) {
    const mode = parseMode(ctx.eve.caller?.attributes.mode);
    return {
      auth: defaultEveAuth(ctx),
      context: [`Console mode for this turn: ${mode.toUpperCase()}.`],
    };
  },
});
