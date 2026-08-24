"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", inputMode, ...props }, ref) => {
    // Les champs numériques utilisent des chiffres tabulaires afin que la
    // largeur ne bouge pas pendant la saisie.
    const numeric =
      inputMode === "decimal" || inputMode === "numeric" || type === "number";

    return (
      <input
        ref={ref}
        type={type}
        inputMode={inputMode}
        className={cn(
          "peer bg-surface-2 text-ink border-hairline flex h-10 w-full rounded-xl border px-3 py-2 text-sm",
          "transition-[border-color,box-shadow,background-color] duration-150 ease-out",
          "placeholder:text-ink-faint",
          "hover:border-hairline-strong",
          "focus-visible:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent/35 outline-none",
          "disabled:cursor-not-allowed disabled:opacity-45",
          "aria-invalid:border-negative/60 aria-invalid:focus-visible:ring-negative/30",
          "file:text-ink file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium",
          numeric && "tnum",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
