"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { Mic, MicOff, Send, Square, Wrench } from "lucide-react";
import { toast } from "sonner";
import { MODES, MODE_LABELS, type Mode, type ToolEvent } from "@/lib/alic3x/tools";
import { cn } from "@/lib/utils";

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) window.location.assign("/login");
  if (!res.ok)
    throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

type Turn = { id: string; role: "user" | "agent"; text: string; channel: "voice" | "text" };
type Session = { id: string; signedUrl: string | null };

export function Alic3xConsole({ email }: { email?: string }) {
  return (
    <ConversationProvider>
      <ConsoleInner email={email} />
    </ConversationProvider>
  );
}

function ConsoleInner({ email }: { email?: string }) {
  const [mode, setMode] = useState<Mode>("produce");
  const [session, setSession] = useState<Session | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [events, setEvents] = useState<ToolEvent[]>([]);
  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const transcriptEnd = useRef<HTMLDivElement>(null);

  const addTurn = useCallback((t: Omit<Turn, "id">) => {
    setTurns((prev) => [...prev, { ...t, id: crypto.randomUUID() }]);
  }, []);
  const mergeEvents = useCallback((incoming: ToolEvent[]) => {
    setEvents((prev) => {
      const seen = new Set(prev.map((e) => e.id));
      const fresh = incoming.filter((e) => !seen.has(e.id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
  }, []);

  const voice = useConversation({
    onMessage: ({ message, role }) => addTurn({ role, text: message, channel: "voice" }),
    onError: (message) => toast.error(`Voice: ${message}`),
  });
  const live = voice.status === "connected";

  useEffect(() => {
    api<{ sessionId: string; signedUrl: string | null }>("/api/session", { mode: "produce" })
      .then((s) => setSession({ id: s.sessionId, signedUrl: s.signedUrl }))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Couldn't start a session"));
  }, []);

  useEffect(() => {
    const check = () =>
      api<{ online: boolean }>("/api/bridge-status")
        .then((s) => setBridgeOnline(s.online))
        .catch(() => setBridgeOnline(false));
    void check();
    const t = setInterval(check, 10_000);
    return () => clearInterval(t);
  }, []);

  // Voice turns execute server-side (ElevenLabs → webhook → brain); pull their tool calls in.
  useEffect(() => {
    if (!live || !session) return;
    const t = setInterval(() => {
      api<ToolEvent[]>(`/api/tool-events?sessionId=${encodeURIComponent(session.id)}`)
        .then(mergeEvents)
        .catch(() => {});
    }, 2_000);
    return () => clearInterval(t);
  }, [live, session, mergeEvents]);

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const startVoice = useCallback(
    async (m: Mode) => {
      if (!session?.signedUrl) return;
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        voice.startSession({
          signedUrl: session.signedUrl,
          dynamicVariables: { session_id: session.id, mode: m },
        });
      } catch {
        toast.error("Microphone permission is needed for voice.");
      }
    },
    [session, voice],
  );

  const changeMode = (m: Mode) => {
    setMode(m);
    // The ElevenLabs agent receives mode as a dynamic variable at connect time,
    // so a live voice session reconnects to pick it up.
    if (live) {
      voice.endSession();
      setTimeout(() => void startVoice(m), 300);
    }
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !session || busy) return;
    setDraft("");
    addTurn({ role: "user", text, channel: "text" });
    setBusy(true);
    try {
      const res = await api<{ reply: string; toolEvents: ToolEvent[] }>("/api/ask", {
        sessionId: session.id,
        mode,
        text,
      });
      mergeEvents(res.toolEvents);
      addTurn({ role: "agent", text: res.reply, channel: "text" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Brain request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-2xs tracking-section text-muted uppercase">Musaix Pro</p>
          <h1 className="font-display text-section font-bold">
            Alic<span className="text-accent">3</span>X Voice Console
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <StatusPill label="Bridge" state={bridgeOnline} />
          <StatusPill label="Voice" state={session?.signedUrl ? live : null} idleText="ready" />
          {email && (
            <form action="/auth/signout" method="post">
              <button
                className="rounded-full border border-border px-2.5 py-1 text-muted hover:text-fg"
                title={email}
              >
                Sign out
              </button>
            </form>
          )}
        </div>
      </header>

      <div role="radiogroup" aria-label="Mode" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MODES.map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            onClick={() => changeMode(m)}
            className={cn(
              "rounded-md border px-3 py-2 text-left transition-colors",
              mode === m
                ? "border-accent bg-accent/10"
                : "border-border bg-bg-elevated hover:border-border-strong",
            )}
          >
            <span className="block text-sm font-semibold">{MODE_LABELS[m].label}</span>
            <span className="block text-2xs text-muted">{MODE_LABELS[m].hint}</span>
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_340px]">
        <section className="flex min-h-[50vh] flex-col rounded-lg border border-border bg-bg-elevated">
          <h2 className="border-b border-border px-4 py-2 font-mono text-2xs tracking-section text-muted uppercase">
            Transcript
          </h2>
          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {turns.length === 0 && (
              <p className="text-sm text-subtle">
                Talk or type. Try “set the tempo to 92 and play”, or “mute the drums”.
              </p>
            )}
            {turns.map((t) => (
              <div
                key={t.id}
                className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}
              >
                <p
                  className={cn(
                    "max-w-[85%] rounded-md px-3 py-2 text-sm",
                    t.role === "user" ? "bg-bg-subtle" : "border border-border",
                  )}
                >
                  {t.role === "agent" && (
                    <span className="mr-1 font-semibold text-accent">Alic3X</span>
                  )}
                  {t.text}
                  {t.channel === "voice" && (
                    <Mic className="ml-1 inline size-3 text-subtle" aria-label="voice" />
                  )}
                </p>
              </div>
            ))}
            {busy && <p className="text-sm text-subtle">Alic3X is thinking…</p>}
            <div ref={transcriptEnd} />
          </div>
          <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
            <button
              type="button"
              disabled={!session?.signedUrl}
              onClick={() => (live ? voice.endSession() : void startVoice(mode))}
              title={
                session?.signedUrl
                  ? undefined
                  : "Voice not configured (ELEVENLABS_API_KEY / ELEVENLABS_AGENT_ID)"
              }
              aria-label={live ? "End voice session" : "Start voice session"}
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-40",
                live
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-border-strong hover:bg-bg-subtle",
              )}
            >
              {live ? (
                voice.isSpeaking ? (
                  <Square className="size-4" />
                ) : (
                  <Mic className="size-4" />
                )
              ) : (
                <MicOff className="size-4" />
              )}
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={live ? "Voice is live — or type here" : "Type a command…"}
              aria-label="Message"
              className="h-10 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-sm outline-none focus:border-border-strong"
            />
            <button
              type="submit"
              disabled={!draft.trim() || !session || busy}
              aria-label="Send"
              className="grid size-10 shrink-0 place-items-center rounded-md bg-fg text-bg disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          </form>
        </section>

        <aside className="flex min-h-[30vh] flex-col rounded-lg border border-border bg-bg-elevated">
          <h2 className="flex items-center gap-2 border-b border-border px-4 py-2 font-mono text-2xs tracking-section text-muted uppercase">
            <Wrench className="size-3" /> Tool feed
          </h2>
          <ol className="flex-1 space-y-2 overflow-y-auto p-3">
            {events.length === 0 && <li className="text-sm text-subtle">No tool calls yet.</li>}
            {[...events].reverse().map((e) => (
              <li
                key={e.id}
                className="rounded-sm border border-border bg-bg p-2 font-mono text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={e.ok ? "text-fg" : "text-accent"}>
                    {e.ok ? "✓" : "✗"} {e.tool}
                  </span>
                  <span className="text-subtle">{e.ms}ms</span>
                </div>
                {e.args && Object.keys(e.args as object).length > 0 && (
                  <div className="mt-1 break-all text-muted">{JSON.stringify(e.args)}</div>
                )}
                {e.error && <div className="mt-1 break-words text-accent">{e.error}</div>}
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}

function StatusPill({
  label,
  state,
  idleText = "down",
}: {
  label: string;
  state: boolean | null;
  idleText?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
      <span
        className={cn(
          "size-1.5 rounded-full",
          state === null
            ? "bg-subtle"
            : state
              ? "bg-emerald-400"
              : idleText === "down"
                ? "bg-accent"
                : "bg-muted",
        )}
      />
      {label}
      <span className="text-muted">{state === null ? "off" : state ? "live" : idleText}</span>
    </span>
  );
}
