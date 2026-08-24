"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "relative inline-flex select-none items-center justify-center gap-2",
    "whitespace-nowrap rounded-xl font-medium",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out",
    "outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
    "disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-white shadow-accent hover:bg-accent-soft active:translate-y-px",
        secondary:
          "border border-hairline bg-surface-2 text-ink hover:bg-surface-3 hover:border-hairline-strong active:translate-y-px",
        ghost: "text-ink-muted hover:bg-surface-2 hover:text-ink",
        danger:
          "bg-negative-dim text-negative border border-negative/25 hover:bg-negative hover:text-white hover:border-transparent",
        outline:
          "border border-hairline-strong bg-transparent text-ink hover:bg-surface-2",
      },
      size: {
        sm: "h-8 px-3 text-[13px] [&_svg]:size-3.5",
        md: "h-10 px-4 text-sm [&_svg]:size-4",
        lg: "h-12 px-6 text-[15px] [&_svg]:size-[18px]",
        icon: "size-10 p-0 [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Rend le bouton via son enfant unique (Radix `Slot`). */
  asChild?: boolean;
  /** Affiche un indicateur de chargement et désactive l'interaction. */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      children,
      type,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";

    // En `asChild`, l'enfant contrôle son propre rendu : on ne peut pas y
    // injecter de spinner sans casser la contrainte d'enfant unique de Slot.
    if (asChild) {
      return (
        <Comp
          ref={ref}
          className={cn(buttonVariants({ variant, size }), className)}
          data-loading={loading || undefined}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        data-loading={loading || undefined}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
