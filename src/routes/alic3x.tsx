import { createFileRoute } from "@tanstack/react-router";
import { Alic3xConsole } from "@/components/alic3x/console";
import { GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/alic3x")({
  head: () => ({ meta: [{ title: "Alic3X Voice Console — Musaix Pro" }] }),
  component: Alic3xPage,
});

function Alic3xPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return null;
  if (!user) {
    return (
      <main className="grid min-h-dvh place-items-center px-4">
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="font-display text-section font-bold">
            Alic<span className="text-accent">3</span>X
          </h1>
          <p className="text-sm text-muted">Sign in to open the voice console.</p>
          <div className="flex justify-center gap-2">
            {GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                onClick={() => void signIn(p.providerId, { callbackURL: "/alic3x" })}
                className="rounded-md border border-border-strong px-4 py-2 text-sm hover:bg-bg-subtle"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }
  return <Alic3xConsole />;
}
