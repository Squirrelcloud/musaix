import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "Do I need a physical pad?",
    a: "No. Musaix is the pad — sixteen velocity-aware pads and six knobs in the browser. If you already own hardware, plug it in: Web MIDI will trigger the same grid.",
  },
  {
    q: "Will it talk to Ableton Live?",
    a: "Yes. Create a virtual MIDI port (IAC Driver on Mac, loopMIDI on Windows), select it as Musaix output, then enable Track on that input in Ableton’s MIDI preferences. Arm a drum rack and record.",
  },
  {
    q: "Which browsers work?",
    a: "Chrome, Edge, and Arc for full Web MIDI. Safari plays the built-in synth; MIDI output there depends on OS support. Use a Chromium browser for the DAW bridge.",
  },
  {
    q: "How does the AI configurator work?",
    a: "You type a genre or a reference. Musaix returns pad labels, MIDI notes, sound types, and colors for the 16-pad grid. Sound Lab does the same for a single pad’s synth parameters.",
  },
  {
    q: "Is this samples or synthesis?",
    a: "Synthesis. Kicks, snares, hats, toms, claps, and custom patches are oscillators and noise on the Web Audio API — so there is no sample-license paperwork and no disk hit.",
  },
  {
    q: "Can I cancel?",
    a: "Anytime. Producer is a 14-day trial with no card on file for the waitlist. Studio is billed monthly or yearly; seats drop at the end of the period.",
  },
];

export function Faq() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-24">
        <p className="text-xs font-medium tracking-section text-subtle uppercase">FAQ</p>
        <h2 className="mt-3 font-display text-title font-semibold text-fg">Before you arm the track.</h2>
        <Accordion type="single" collapsible className="mt-10">
          {FAQS.map((item, i) => (
            <AccordionItem key={item.q} value={`item-${i}`}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
