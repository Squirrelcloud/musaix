import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#features", label: "Features" },
  { href: "#stories", label: "Stories" },
  { href: "#pricing", label: "Pricing" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const ids = LINKS.map((l) => l.href.slice(1));
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(`#${visible.target.id}`);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5] },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 h-[var(--nav-h)] transition-[background-color,box-shadow] duration-200 ease-out",
        scrolled ? "bg-bg/90 shadow-[var(--shadow-border)]" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2.5 text-fg">
          <LogoMark />
          <span className="font-display text-lg font-bold tracking-tight">Musaix</span>
        </a>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={active === link.href ? "page" : undefined}
              className={cn(
                "rounded-sm px-3 py-2 text-sm font-medium transition-[color,background-color] duration-150 ease-out",
                active === link.href ? "text-fg bg-bg-subtle" : "text-muted hover:text-fg",
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button asChild size="sm">
            <a href="#signup">
              Start free
            </a>
          </Button>
        </div>

        <button
          type="button"
          className="flex size-11 items-center justify-center rounded-sm text-fg md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open ? (
        <div className="fixed inset-x-0 top-[var(--nav-h)] bottom-0 z-40 bg-bg px-6 py-6 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex h-12 items-center text-lg font-medium text-fg"
              >
                {link.label}
              </a>
            ))}
            <Button asChild size="lg" className="mt-4 w-full">
              <a href="#signup" onClick={() => setOpen(false)}>
                Start free
              </a>
            </Button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-7", className)}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="7" className="fill-bg-subtle" />
      <rect x="5" y="5" width="10" height="10" rx="2.5" className="fill-accent" />
      <rect x="17" y="5" width="10" height="10" rx="2.5" className="fill-bg-elevated" />
      <rect x="5" y="17" width="10" height="10" rx="2.5" className="fill-bg-elevated" />
      <rect x="17" y="17" width="10" height="10" rx="2.5" className="fill-bg-elevated" />
    </svg>
  );
}
