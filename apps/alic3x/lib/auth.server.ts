import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { emailAllowed } from "./allowlist";

/**
 * Supabase Auth (the "Auth" in the Supabase box of the architecture).
 *
 * Fail-closed: this console spends model credits and drives a real DAW, so in
 * production a request is allowed only when Supabase Auth is configured, the
 * caller is signed in, and their email is on ALIC3X_ALLOWED_EMAILS. Local dev
 * without Supabase runs as a single "dev-user".
 */

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const isProd = () => process.env.NODE_ENV === "production";

export function authConfigured(): boolean {
  return Boolean(url() && anonKey());
}

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(url()!, anonKey()!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Server Components can't write cookies; route handlers refresh them instead.
        }
      },
    },
  });
}

export type AuthState =
  | { ok: true; userId: string; email?: string }
  | { ok: false; reason: "signed-out" | "not-allowed" | "not-configured" };

export async function currentUser(): Promise<AuthState> {
  if (!authConfigured()) {
    return isProd() ? { ok: false, reason: "not-configured" } : { ok: true, userId: "dev-user" };
  }
  const { data } = await (await supabaseServer()).auth.getUser();
  const user = data.user;
  if (!user) return { ok: false, reason: "signed-out" };
  if (!emailAllowed(user.email, process.env.ALIC3X_ALLOWED_EMAILS, isProd())) {
    return { ok: false, reason: "not-allowed" };
  }
  return { ok: true, userId: user.id, email: user.email };
}

/** Route-handler guard: returns the user id, or a 401/403 Response. */
export async function requireUser(): Promise<string | Response> {
  const state = await currentUser();
  if (state.ok) return state.userId;
  const status = state.reason === "not-allowed" ? 403 : 401;
  return Response.json({ error: state.reason }, { status });
}
