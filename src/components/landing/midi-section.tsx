import { Button } from "@/components/ui/button";

const DAWS = ["Ableton Live", "Logic Pro", "FL Studio", "Bitwig", "Cubase", "Reason"];

export function MidiSection() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div className="lg:order-2">
          <img
            src="/studio/desk.jpg"
            alt="A dark 16-pad controller on a studio desk with nearfield monitors"
            className="media aspect-video w-full rounded-xl object-cover"
          />
        </div>
        <div className="lg:order-1">
          <p className="text-xs font-medium tracking-section text-subtle uppercase">DAW bridge</p>
          <h2 className="mt-3 font-display text-title font-semibold text-fg">
            Built to sit in front of the drum rack, not instead of it.
          </h2>
          <p className="mt-4 leading-relaxed text-muted">
            Musaix speaks Web MIDI. Create a virtual port (IAC on Mac, loopMIDI on
            Windows), select it as the output, and Ableton sees a controller — notes,
            velocity, and learned CCs on the six knobs.
          </p>
          <ul className="mt-8 flex flex-wrap gap-2">
            {DAWS.map((d) => (
              <li
                key={d}
                className="rounded-full bg-bg-subtle px-3 py-1.5 text-xs font-medium text-muted shadow-[var(--shadow-border)]"
              >
                {d}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Button asChild variant="secondary">
              <a href="#signup">Get MIDI access</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
