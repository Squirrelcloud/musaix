import { EmailForm } from "@/components/landing/email-form";

export function Signup() {
  return (
    <section id="signup" className="border-t border-border">
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-24">
        <p className="text-xs font-medium tracking-section text-subtle uppercase">Start free</p>
        <h2 className="mt-3 font-display text-title font-semibold text-fg">
          Play the kit tonight. Ship the beat this week.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-muted">
          Join the waitlist for Producer access — 14 days, no card, the same 16-pad
          surface you just played. We’ll send a seat, not a newsletter.
        </p>
        <div className="mx-auto mt-8 max-w-md text-left">
          <EmailForm source="footer" size="lg" />
        </div>
      </div>
    </section>
  );
}
