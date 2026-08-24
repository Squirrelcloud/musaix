import { PadSurface } from "@/components/landing/pad-surface";
import { EmailForm } from "@/components/landing/email-form";
import { Badge } from "@/components/ui/badge";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="grain" />
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:py-20">
        <div className="stagger-in min-w-0 max-w-xl">
          <Badge>
            <span className="size-1.5 rounded-full bg-accent" />
            Now in private beta
          </Badge>
          <h1 className="mt-5 font-display text-display font-semibold leading-tight text-fg">
            Type a genre.
            <br />
            Play the kit.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            Musaix is the AI drum pad for producers. Generate a 16-pad layout from a
            sentence, hit it with zero-latency synthesis, and route MIDI straight into
            Ableton, Logic, or FL Studio.
          </p>
          <div className="mt-8 max-w-md">
            <EmailForm source="hero" />
            <p className="mt-2.5 text-xs text-subtle">
              Producer plan free for 14 days. No card. Cancel anytime.
            </p>
          </div>
          <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-border pt-6">
            {[
              { k: "Kits generated", v: "12.4k" },
              { k: "Audio path", v: "0.8ms" },
              { k: "MIDI notes", v: "128" },
            ].map((stat) => (
              <div key={stat.k}>
                <dt className="text-xs text-subtle">{stat.k}</dt>
                <dd className="mt-1 font-display text-xl font-semibold tabular-nums text-fg">
                  {stat.v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <PadSurface />
      </div>
    </section>
  );
}
