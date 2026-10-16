"use client";

import { useState, type FormEvent } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setState("error");
      setError("Supabase Auth isn't configured for this deployment.");
      return;
    }
    setState("sending");
    const { error } = await createBrowserClient(url, key).auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setState("error");
      setError(error.message);
    } else {
      setState("sent");
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <p className="font-mono text-2xs tracking-section text-muted uppercase">Musaix Pro</p>
          <h1 className="font-display text-section font-bold">
            Alic<span className="text-accent">3</span>X
          </h1>
        </div>
        {state === "sent" ? (
          <p className="text-center text-sm text-muted">Check {email} for a sign-in link.</p>
        ) : (
          <>
            <label className="block space-y-1.5">
              <span className="text-sm text-muted">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm outline-none focus:border-border-strong"
              />
            </label>
            <button
              disabled={state === "sending"}
              className="h-10 w-full rounded-md bg-fg text-sm font-semibold text-bg disabled:opacity-50"
            >
              {state === "sending" ? "Sending…" : "Email me a sign-in link"}
            </button>
            {state === "error" && <p className="text-sm text-accent">{error}</p>}
          </>
        )}
      </form>
    </main>
  );
}
