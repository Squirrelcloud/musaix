import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TIERS = [
  {
    id: "free",
    name: "Free",
    monthly: 0,
    yearly: 0,
    blurb: "Play the pad. Keep three kits.",
    cta: "Get started",
    href: "#signup",
    featured: false,
    features: [
      "16-pad surface + six knobs",
      "Browser synthesis",
      "Three saved kits",
      "Computer-keyboard mapping",
    ],
  },
  {
    id: "producer",
    name: "Producer",
    monthly: 16,
    yearly: 13,
    blurb: "Unlimited kits, Sound Lab, MIDI out.",
    cta: "Start 14-day trial",
    href: "#signup",
    featured: true,
    features: [
      "Everything in Free",
      "Unlimited kit library",
      "AI pad configurator",
      "Sound Lab + voice input",
      "MIDI learn and DAW output",
      "Per-pad velocity curves",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    monthly: 39,
    yearly: 32,
    blurb: "Rooms, seats, and first in the queue.",
    cta: "Talk to us",
    href: "#signup",
    featured: false,
    features: [
      "Everything in Producer",
      "Five seats",
      "Shared kit library",
      "Priority generation",
      "DAW drum-rack templates",
      "Session export",
    ],
  },
];

export function Pricing() {
  const [yearly, setYearly] = useState(true);

  return (
    <section id="pricing" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-medium tracking-section text-subtle uppercase">Pricing</p>
            <h2 className="mt-3 font-display text-title font-semibold text-fg">
              Pay for the engine, not another controller.
            </h2>
          </div>
          <div className="flex rounded-full bg-bg-subtle p-1 shadow-[var(--shadow-border)]">
            <button
              type="button"
              onClick={() => setYearly(false)}
              className={cn(
                "h-10 rounded-full px-4 text-sm font-medium transition-[background-color,color] duration-150 ease-out",
                !yearly ? "bg-fg text-bg" : "text-muted hover:text-fg",
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setYearly(true)}
              className={cn(
                "h-10 rounded-full px-4 text-sm font-medium transition-[background-color,color] duration-150 ease-out",
                yearly ? "bg-fg text-bg" : "text-muted hover:text-fg",
              )}
            >
              Yearly
              <span className="ml-1.5 text-xs opacity-70">−20%</span>
            </button>
          </div>
        </div>

        <ul className="mt-12 grid gap-4 lg:grid-cols-3">
          {TIERS.map((tier) => {
            const price = yearly ? tier.yearly : tier.monthly;
            return (
              <li
                key={tier.id}
                className={cn(
                  "flex flex-col rounded-xl p-6",
                  tier.featured
                    ? "bg-fg text-bg"
                    : "bg-bg-elevated text-fg shadow-[var(--shadow-border)]",
                )}
              >
                <p className={cn("text-sm font-medium", tier.featured ? "text-bg/70" : "text-muted")}>
                  {tier.name}
                </p>
                <p className="mt-4 flex items-end gap-1">
                  <span className="font-display text-4xl font-semibold tabular-nums tracking-tight">
                    ${price}
                  </span>
                  <span className={cn("mb-1 text-sm", tier.featured ? "text-bg/60" : "text-subtle")}>
                    /mo
                  </span>
                </p>
                <p className={cn("mt-2 text-sm", tier.featured ? "text-bg/70" : "text-muted")}>
                  {tier.blurb}
                </p>
                <Button
                  asChild
                  variant={tier.featured ? "accent" : "primary"}
                  className={cn("mt-6 w-full", !tier.featured && "bg-fg text-bg")}
                >
                  <a href={tier.href}>{tier.cta}</a>
                </Button>
                <ul className="mt-6 space-y-2.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex gap-2.5 text-sm">
                      <Check
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          tier.featured ? "text-accent" : "text-muted",
                        )}
                        strokeWidth={2}
                      />
                      <span className={tier.featured ? "text-bg/80" : "text-muted"}>{f}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
