const STORIES = [
  {
    quote:
      "I used to spend an hour building a kit. Musaix gave me a usable techno grid in eight seconds and I tracked the verse the same night.",
    name: "Kenji Mori",
    role: "Techno producer, Berlin",
    img: "/portraits/kenji.jpg",
  },
  {
    quote:
      "The Sound Lab is the part I didn’t expect. I said ‘dusty rim with a long room’ and it sat on pad 16 like I’d sampled it.",
    name: "Elena Voss",
    role: "Analog sessions, Los Angeles",
    img: "/portraits/elena.jpg",
  },
  {
    quote:
      "I bounce between an MPD and this. When I’m on a laptop in a hotel, Musaix is the pad. MIDI into Ableton, no driver circus.",
    name: "Mateo Ruiz",
    role: "Beatmaker, Houston",
    img: "/portraits/mateo.jpg",
  },
  {
    quote:
      "House kits used to be a folder of 808s I never named. Now I type the record I’m chasing and play. That’s the whole pitch.",
    name: "Nia Brooks",
    role: "House & R&B, Atlanta",
    img: "/portraits/nia.jpg",
  },
];

export function Testimonials() {
  return (
    <section id="stories" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <p className="text-xs font-medium tracking-section text-subtle uppercase">Stories</p>
        <h2 className="mt-3 max-w-2xl font-display text-title font-semibold text-fg">
          From people who actually finish records.
        </h2>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2">
          {STORIES.map((s) => (
            <li
              key={s.name}
              className="flex flex-col rounded-xl bg-bg-elevated p-6 shadow-[var(--shadow-border)]"
            >
              <blockquote className="flex-1 text-sm leading-relaxed text-fg sm:text-base">
                {s.quote}
              </blockquote>
              <div className="mt-6 flex items-center gap-3">
                <img
                  src={s.img}
                  alt=""
                  width={44}
                  height={44}
                  className="media size-11 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-medium text-fg">{s.name}</p>
                  <p className="text-xs text-subtle">{s.role}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
