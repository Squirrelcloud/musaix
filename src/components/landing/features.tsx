import {
  AudioLines,
  Cpu,
  Keyboard,
  Library,
  Mic,
  Repeat,
} from "lucide-react";

const FEATURES = [
  {
    icon: Cpu,
    title: "AI pad configurator",
    body: "Describe a session — “heavy industrial techno” — and Musaix maps a 16-pad grid with notes, types, and labels in seconds.",
  },
  {
    icon: AudioLines,
    title: "Zero-latency synthesis",
    body: "Kicks, snares, hats, toms, and custom patches run on the Web Audio graph. No sample pack. No round-trip.",
  },
  {
    icon: Keyboard,
    title: "MIDI in and out",
    body: "Learn CCs, hit pads from a controller, and send notes to Ableton over IAC or loopMIDI. The red stripe is not just decoration.",
  },
  {
    icon: Mic,
    title: "Sound Lab",
    body: "Type a sound — “spacey laser kick” — or speak it. Musaix writes the synth params and parks it on a pad.",
  },
  {
    icon: Library,
    title: "Kit library",
    body: "Save generated layouts with a name and timestamp. Recall them instantly when the session starts without you.",
  },
  {
    icon: Repeat,
    title: "Performance controls",
    body: "Note repeat, full level, per-pad velocity curves, and six assignable knobs — Attack through Sweep — the way hardware works.",
  },
];

export function Features() {
  return (
    <section id="features" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <p className="text-xs font-medium tracking-section text-subtle uppercase">Features</p>
        <h2 className="mt-3 max-w-2xl font-display text-title font-semibold text-fg">
          Everything on a hardware surface. Nothing that requires hardware.
        </h2>
        <p className="mt-4 max-w-xl text-muted">
          Musaix Pro is a browser-native MPD: sixteen pads, six knobs, an AI engineer
          sitting in the left rail.
        </p>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li
              key={f.title}
              className="rounded-xl bg-bg-elevated p-6 shadow-[var(--shadow-border)]"
            >
              <span className="flex size-10 items-center justify-center rounded-md bg-bg-subtle text-fg">
                <f.icon className="size-5" strokeWidth={1.75} />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold text-fg">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
