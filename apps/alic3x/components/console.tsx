"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useEveAgent, type EveMessagePart } from "eve/react";
import { Mic, MicOff, Send, Square, Wrench } from "lucide-react";
import { toast } from "sonner";
import { MODES, MODE_HEADER, MODE_LABELS, type Mode } from "@/agent/lib/modes";
import { cn } from "@/lib/utils";

type ToolPart = Extract<EveMessagePart, { type: "dynamic-tool" }>;

export function Alic3xConsole({ email }: { email?: string }) {
  return (
    <ConversationProvider>
      <ConsoleInner email={email} />
    </ConversationProvider>
  );
}

function ConsoleInner({ email }: { email?: string }) {
  const [mode, setMode] = useState<Mode>("produce");
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;
  const [signedUrl, setSignedUrl] = useState<string | null | undefined>(undefined);
  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null);
  const [draft, setDraft] = useState("");
  const transcriptEnd = useRef<HTMLDivElement>(null);

  // The eve agent is the brain. Text turns go straight to it; voice turns reach
  // the same session through the ElevenLabs webhook, and this stream shows both.
  const agent = useEveAgent({
    headers: () => ({ [MODE_HEADER]: modeRef.current }),
    onError: (err) => toast.error(err.message),
  });
  const busy = agent.status === "submitted" || agent.status === "streaming";
  const agentRef = useRef(agent);
  agentRef.current = agent;

  const voice = useConversation({
    onError: (message) => toast.error(`Voice: ${message}`),
  });
  const live = voice.status === "connected";

  useEffect(() => {
    fetch("/api/voice", { method: "POST" })
      .then((r) => (r.status === 401 ? (window.location.assign("/login"), null) : r.json()))
      .then((d) => setSignedUrl(d?.signedUrl ?? null))
      .catch(() => setSignedUrl(null));
  }, []);

  useEffect(() => {
    const check = () =>
      fetch("/api/bridge-status")
        .then((r) => r.json())
        .then((s: { online?: boolean }) => setBridgeOnline(Boolean(s.online)))
        .catch(() => setBridgeOnline(false));
    void check();
    const t = setInterval(check, 10_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [agent.data.messages]);

  const toolParts = useMemo(
    () =>
      agent.data.messages.flatMap((m) =>
        m.parts.filter((p): p is ToolPart => p.type === "dynamic-tool"),
      ),
    [agent.data.messages],
  );

  const startVoice = useCallback(
    async (m: Mode) => {
      if (!signedUrl) return;
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        // Voice needs the eve session ID up front so the webhook can post into it.
        if (!agentRef.current.session) await agentRef.current.prewarm();
        let sessionId = agentRef.current.session?.sessionId;
        for (let i = 0; !sessionId && i < 20; i++) {
          await new Promise((r) => setTimeout(r, 100));
          sessionId = agentRef.current.session?.sessionId;
        }
        if (!sessionId) throw new Error("Couldn't open an Alic3X session");
        voice.startSession({ signedUrl, dynamicVariables: { session_id: sessionId, mode: m } });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't start voice");
      }
    },
    [signedUrl, voice],
  );

  const changeMode = (m: Mode) => {
    setMode(m);
    // ElevenLabs gets the mode as a dynamic variable at connect time, so a live
    // voice session reconnects to pick it up. Text turns read it per request.
    if (live) {
      voice.endSession();
      setTimeout(() => void startVoice(m), 300);
    }
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || agent.status === "resuming") return;
    setDraft("");
    void agent.send(text, busy ? { turnPolicy: "steer" } : undefined);
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
          <StatusPill label="Voice" state={signedUrl ? live : null} idleText="ready" />
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
            {agent.data.messages.length === 0 && (
              <p className="text-sm text-subtle">
                Talk or type. Try “set the tempo to 92 and play”, or “mute the drums”.
              </p>
            )}
            {agent.data.messages.map((m) => {
              const text = m.parts
                .filter((p) => p.type === "text")
                .map((p) => (p as { text: string }).text)
                .join("");
              if (!text) return null;
              const isUser = m.role === "user";
              return (
                <div key={m.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                  <p
                    className={cn(
                      "max-w-[85%] rounded-md px-3 py-2 text-sm whitespace-pre-wrap",
                      isUser ? "bg-bg-subtle" : "border border-border",
                    )}
                  >
                    {!isUser && <span className="mr-1 font-semibold text-accent">Alic3X</span>}
                    {text}
                  </p>
                </div>
              );
            })}
            {busy && <p className="text-sm text-subtle">Alic3X is thinking…</p>}
            <div ref={transcriptEnd} />
          </div>
          <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
            <button
              type="button"
              disabled={!signedUrl}
              onClick={() => (live ? voice.endSession() : void startVoice(mode))}
              title={
                signedUrl
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
              disabled={!draft.trim() || agent.status === "resuming"}
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
            {toolParts.length === 0 && <li className="text-sm text-subtle">No tool calls yet.</li>}
            {[...toolParts].reverse().map((p) => {
              const failed = p.state === "output-error";
              const done = p.state === "output-available";
              return (
                <li
                  key={p.toolCallId}
                  className="rounded-sm border border-border bg-bg p-2 font-mono text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={failed ? "text-accent" : "text-fg"}>
                      {failed ? "✗" : done ? "✓" : "…"} {p.toolMetadata?.eve?.label ?? p.toolName}
                    </span>
                    <span className="text-subtle">{p.toolName}</span>
                  </div>
                  {failed && p.errorText && (
                    <div className="mt-1 break-words text-accent">{p.errorText}</div>
                  )}
                </li>
              );
            })}
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
