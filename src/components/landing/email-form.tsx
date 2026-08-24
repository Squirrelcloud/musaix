import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "musaix-waitlist-email";
const emailSchema = z.email("Enter a valid email");

export function EmailForm({
  id,
  size = "md",
  source,
}: {
  id?: string;
  size?: "md" | "lg";
  source: string;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      setJoined(localStorage.getItem(STORAGE_KEY));
    } catch {
      /* ignore */
    }
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "Enter a valid email";
      setError(first);
      return;
    }
    setError(null);
    setSubmitting(true);
    window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, parsed.data);
        localStorage.setItem(`${STORAGE_KEY}-source`, source);
      } catch {
        /* ignore */
      }
      setJoined(parsed.data);
      setSubmitting(false);
      toast.success("You're on the list. We'll send Producer-plan access.");
    }, 280);
  }

  if (joined) {
    return (
      <div
        className={cn(
          "flex min-w-0 items-center gap-3 rounded-md bg-bg-subtle px-4 py-3 text-sm text-fg shadow-[var(--shadow-border)]",
          size === "lg" && "px-5 py-4",
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fg text-bg">
          <Check className="size-4" strokeWidth={2.4} />
        </span>
        <p className="min-w-0 break-words">
          <span className="font-medium">You're in.</span>{" "}
          <span className="text-muted">We'll write {joined} when seats open.</span>
        </p>
      </div>
    );
  }

  return (
    <form id={id} onSubmit={onSubmit} className="w-full" noValidate>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <label htmlFor={`email-${source}`} className="sr-only">
            Email address
          </label>
          <Input
            id={`email-${source}`}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@studio.com"
            value={email}
            onChange={(ev) => {
              setEmail(ev.target.value);
              if (error) setError(null);
            }}
            aria-invalid={Boolean(error)}
            className={cn(size === "lg" && "h-12 rounded-md")}
          />
          {error ? <p className="mt-1.5 text-xs text-accent">{error}</p> : null}
        </div>
        <Button
          type="submit"
          variant="primary"
          size={size === "lg" ? "lg" : "md"}
          disabled={submitting}
          className="shrink-0 sm:min-w-40"
        >
          {submitting ? "Joining…" : "Start free"}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </form>
  );
}
