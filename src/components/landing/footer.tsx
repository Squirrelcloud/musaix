import { LogoMark } from "@/components/landing/nav";

const COLS = [
  {
    title: "Product",
    links: [
      { href: "#product", label: "Controller" },
      { href: "#features", label: "Features" },
      { href: "#pricing", label: "Pricing" },
    ],
  },
  {
    title: "Studio",
    links: [
      { href: "#stories", label: "Stories" },
      { href: "#signup", label: "Waitlist" },
      { href: "#pricing", label: "Compare plans" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 md:flex-row md:justify-between">
        <div className="max-w-xs">
          <a href="#top" className="inline-flex items-center gap-2 text-fg">
            <LogoMark />
            <span className="font-display text-lg font-bold tracking-tight">Musaix</span>
          </a>
          <p className="mt-3 text-sm text-muted">Play the kit. Ship the beat.</p>
        </div>
        <div className="flex gap-16">
          {COLS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-medium tracking-section text-subtle uppercase">
                {col.title}
              </p>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-sm text-muted transition-[color] duration-150 ease-out hover:text-fg"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-subtle sm:flex-row sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Musaix. All rights reserved.</p>
          <p>Web MIDI · Web Audio · Ableton-ready</p>
        </div>
      </div>
    </footer>
  );
}
