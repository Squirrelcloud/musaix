import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "h-11 w-full rounded-sm bg-bg-subtle px-3.5 text-sm text-fg placeholder:text-subtle shadow-[var(--shadow-border)] outline-none transition-[box-shadow,background-color] duration-150 ease-out focus-visible:shadow-[var(--shadow-border-hover)] focus-visible:ring-2 focus-visible:ring-fg/30",
        className,
      )}
      {...props}
    />
  );
}
