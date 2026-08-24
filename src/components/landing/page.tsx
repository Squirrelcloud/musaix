import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { MidiSection } from "@/components/landing/midi-section";
import { Testimonials } from "@/components/landing/testimonials";
import { Pricing } from "@/components/landing/pricing";
import { Faq } from "@/components/landing/faq";
import { Signup } from "@/components/landing/signup";
import { Footer } from "@/components/landing/footer";

const DAWS = ["Ableton Live", "Logic Pro", "FL Studio", "Bitwig", "Cubase", "Reason"];

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <Nav />
      <main>
        <Hero />
        <div className="border-y border-border">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-2xs font-medium tracking-section text-subtle uppercase">
              Routes MIDI to
            </p>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {DAWS.map((d) => (
                <li key={d} className="text-sm font-medium text-muted">
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <Features />
        <HowItWorks />
        <MidiSection />
        <Testimonials />
        <Pricing />
        <Faq />
        <Signup />
      </main>
      <Footer />
    </div>
  );
}
