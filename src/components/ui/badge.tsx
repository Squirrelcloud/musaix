import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-bg-subtle px-3 py-1 text-xs font-medium tracking-wide text-muted shadow-[var(--shadow-border)]",
        className,
      )}
    >
      {children}
    </span>
  );
}