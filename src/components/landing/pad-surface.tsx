import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Play, Square } from "lucide-react";
import { DEFAULT_KIT, GRID_ORDER, KEY_TO_PAD, KITS, type Kit, type PadDef } from "@/lib/kits";
import { initAudio, playPad, setMasterVolume } from "@/lib/audio";
import { cn } from "@/lib/utils";

function volumeToMidi(v: number) {
  return Math.round(v * 127);
}

export function PadSurface({ onReady }: { onReady?: (api: { playGroove: () => void }) => void }) {
  const [kit, setKit] = useState<Kit>(DEFAULT_KIT);
  const [active, setActive] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.72);
  const [knobs, setKnobs] = useState([96, 64, 40, 80, 18, 70]);
  const kitRef = useRef(kit);
  const playingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const stepRef = useRef(0);

  useEffect(() => {
    kitRef.current = kit;
  }, [kit]);

  const flash = useCallback((id: number) => {
    setActive((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    window.setTimeout(() => {
      setActive((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 110);
  }, []);

  const trigger = useCallback(
    (pad: PadDef) => {
      initAudio();
      playPad(pad.type, pad.label);
      flash(pad.id);
    },
    [flash],
  );

  const stopGroove = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const playGroove = useCallback(() => {
    initAudio();
    if (playingRef.current) {
      stopGroove();
      return;
    }
    const current = kitRef.current;
    playingRef.current = true;
    setPlaying(true);
    stepRef.current = 0;
    const stepMs = (60 / current.bpm) * 1000 / 4;
    const tick = () => {
      const k = kitRef.current;
      const ids = k.groove[stepRef.current] ?? [];
      for (const id of ids) {
        const pad = k.pads.find((p) => p.id === id);
        if (pad) trigger(pad);
      }
      stepRef.current = (stepRef.current + 1) % 16;
    };
    tick();
    timerRef.current = window.setInterval(tick, stepMs);
  }, [stopGroove, trigger]);

  useEffect(() => {
    onReady?.({ playGroove });
  }, [onReady, playGroove]);

  useEffect(() => () => stopGroove(), [stopGroove]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.code === "Space") {
        e.preventDefault();
        playGroove();
        return;
      }
      const id = KEY_TO_PAD[e.code];
      if (!id) return;
      e.preventDefault();
      const pad = kitRef.current.pads.find((p) => p.id === id);
      if (pad) trigger(pad);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playGroove, trigger]);

  function applyKit(next: Kit) {
    if (next.id === kit.id) return;
    stopGroove();
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setKit(next);
      return;
    }
    setGenerating(true);
    window.setTimeout(() => {
      setKit(next);
      setGenerating(false);
    }, 420);
  }

  function onVolume(midi: number) {
    const v = midi / 127;
    setVolume(v);
    setMasterVolume(v);
  }

  return (
    <div
      id="product"
      className="relative min-w-0 overflow-hidden rounded-2xl bg-bg-elevated shadow-[var(--shadow-border),var(--shadow-lift)]"
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden="true" />
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div>
          <p className="font-display text-xl font-bold italic tracking-tight text-fg">MUSAIX PRO</p>
          <p className="text-2xs font-medium tracking-widest text-subtle uppercase">
            Ableton-ready bridge
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 text-2xs font-medium tracking-widest text-subtle uppercase sm:flex">
            <span
              className={cn(
                "size-1.5 rounded-full bg-subtle",
                active.size > 0 && "bg-accent",
              )}
            />
            MIDI
          </span>
          <Knob label="Master" value={volumeToMidi(volume)} onChange={onVolume} />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto px-5 py-3 sm:px-6">
        {KITS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => applyKit(item)}
            className={cn(
              "h-9 shrink-0 rounded-sm px-3 text-xs font-medium tracking-wide transition-[background-color,color,box-shadow] duration-150 ease-out",
              kit.id === item.id
                ? "bg-fg text-bg"
                : "text-muted shadow-[var(--shadow-border)] hover:text-fg hover:bg-bg-subtle",
            )}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className="relative px-5 pb-4 sm:px-6">
        <div
          className={cn(
            "grid grid-cols-4 gap-2 rounded-lg bg-bg p-3 sm:gap-3 sm:p-4",
            generating && "opacity-40",
          )}
        >
          {GRID_ORDER.map((id) => {
            const pad = kit.pads.find((p) => p.id === id);
            if (!pad) return null;
            return (
              <button
                key={id}
                type="button"
                className="pad-key p-2 text-left sm:p-2.5"
                data-active={active.has(id) ? "true" : "false"}
                onPointerDown={(e) => {
                  e.preventDefault();
                  trigger(pad);
                }}
                aria-label={`${pad.label}, MIDI ${pad.note}`}
              >
                <span className="text-2xs tabular-nums opacity-70">{pad.id}</span>
                <span className="truncate text-center text-2xs font-semibold leading-tight sm:text-xs">
                  {pad.label}
                </span>
                <span className="self-end text-2xs tabular-nums opacity-60">{pad.note}</span>
              </button>
            );
          })}
        </div>
        {generating ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm font-medium text-fg">
            Generating kit…
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:px-6">
        <div className="grid flex-1 grid-cols-6 gap-2">
          {["Atk", "Dec", "Base", "End", "Noise", "Sweep"].map((label, i) => (
            <Knob
              key={label}
              label={label}
              value={knobs[i] ?? 0}
              onChange={(v) =>
                setKnobs((prev) => {
                  const next = [...prev];
                  next[i] = v;
                  return next;
                })
              }
            />
          ))}
        </div>
        <button
          type="button"
          onClick={playGroove}
          className={cn(
            "inline-flex h-11 items-center justify-center gap-2 rounded-sm px-4 text-xs font-semibold tracking-wide uppercase transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.96]",
            playing ? "bg-accent text-accent-fg" : "bg-fg text-bg hover:bg-fg/90",
          )}
        >
          {playing ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
          {playing ? "Stop" : "Play groove"}
        </button>
      </div>

      <p className="border-t border-border px-5 py-3 text-2xs text-subtle sm:px-6">
        Prompt: “{kit.prompt}” · {kit.bpm} BPM · keys 1–4 QWER ASDF ZXCV · space to play
      </p>
    </div>
  );
}

function Knob({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const startY = useRef(0);
  const startVal = useRef(0);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    startY.current = e.clientY;
    startVal.current = value;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const delta = startY.current - e.clientY;
    const next = Math.max(0, Math.min(127, startVal.current + delta));
    onChange(Math.round(next));
  }

  const angle = -135 + (value / 127) * 270;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="knob-dial"
        style={{ "--knob-angle": `${angle}deg` } as CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={127}
        aria-valuenow={value}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowRight") onChange(Math.min(127, value + 2));
          if (e.key === "ArrowDown" || e.key === "ArrowLeft") onChange(Math.max(0, value - 2));
        }}
      />
      <span className="text-2xs font-medium tracking-widest text-subtle uppercase">{label}</span>
    </div>
  );
}
