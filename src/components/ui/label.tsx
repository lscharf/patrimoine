"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "@/lib/utils";

export interface LabelProps
  extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
  /** Ajoute l'astérisque des champs obligatoires. */
  required?: boolean;
}

const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  LabelProps
>(({ className, required, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-ink-muted text-[13px] leading-none font-medium select-none",
      "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {children}
    {required ? (
      <span className="text-accent ml-0.5" aria-hidden="true">
        *
      </span>
    ) : null}
  </LabelPrimitive.Root>
));
Label.displayName = "Label";

export { Label };
