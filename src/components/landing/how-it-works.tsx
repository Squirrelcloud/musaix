const STEPS = [
  {
    n: "01",
    title: "Describe the kit",
    body: "A genre, a reference record, a mood. The configurator returns a playable 16-pad map — not a playlist of loops.",
  },
  {
    n: "02",
    title: "Play it immediately",
    body: "Click, tap, or use the computer keyboard. Velocity curves and note repeat behave like the metal box on your desk.",
  },
  {
    n: "03",
    title: "Route it to the DAW",
    body: "Pick a virtual MIDI port. Arm a drum rack in Ableton, Logic, or FL. Record the take. Keep the kit.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div className="relative overflow-hidden rounded-xl">
          <img
            src="/studio/hands.jpg"
            alt="Hands playing a 16-pad MIDI controller in a dim studio"
            className="media aspect-video w-full object-cover"
          />
        </div>
        <div>
          <p className="text-xs font-medium tracking-section text-subtle uppercase">How it works</p>
          <h2 className="mt-3 font-display text-title font-semibold text-fg">
            Three moves from a sentence to a take.
          </h2>
          <ol className="mt-10 space-y-8">
            {STEPS.map((s) => (
              <li key={s.n} className="grid grid-cols-[auto_1fr] gap-4">
                <span className="font-display text-sm font-semibold tabular-nums text-accent">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-medium text-fg">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
