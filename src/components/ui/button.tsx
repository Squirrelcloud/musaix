import type { ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/35 disabled:pointer-events-none disabled:opacity-40 active:not-disabled:scale-[0.96] transition-[scale,background-color,color,box-shadow,opacity] duration-150 ease-out",
  {
    variants: {
      variant: {
        primary: "bg-fg text-bg hover:bg-fg/90",
        secondary:
          "bg-transparent text-fg shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)] hover:bg-bg-subtle",
        ghost: "bg-transparent text-muted hover:text-fg hover:bg-bg-subtle",
        accent: "bg-accent text-accent-fg hover:bg-accent/90",
      },
      size: {
        sm: "h-10 px-3.5 text-sm rounded-sm",
        md: "h-11 px-4 text-sm rounded-sm",
        lg: "h-12 px-5 text-base rounded-md",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
