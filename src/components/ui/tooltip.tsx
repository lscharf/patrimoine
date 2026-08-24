"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipPortal = TooltipPrimitive.Portal;

const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & {
    /** Affiche la petite flèche pointant vers le déclencheur. */
    withArrow?: boolean;
  }
>(({ className, sideOffset = 6, withArrow = true, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "bg-surface-3 text-ink border-hairline-strong shadow-popover z-50",
        "max-w-64 rounded-lg border px-2.5 py-1.5 text-[12px] leading-snug",
        "data-[state=delayed-open]:animate-pop-in data-[state=closed]:animate-pop-out",
        className,
      )}
      {...props}
    >
      {children}
      {withArrow ? (
        <TooltipPrimitive.Arrow className="fill-surface-3" width={10} height={5} />
      ) : null}
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = "TooltipContent";

/**
 * Raccourci pour le cas courant : un déclencheur, un libellé.
 * Doit être rendu sous un `TooltipProvider`.
 */
export interface SimpleTooltipProps {
  label: React.ReactNode;
  children: React.ReactNode;
  side?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>["side"];
  delayDuration?: number;
}

function SimpleTooltip({
  label,
  children,
  side = "top",
  delayDuration = 200,
}: SimpleTooltipProps) {
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </TooltipPrimitive.Root>
  );
}
SimpleTooltip.displayName = "SimpleTooltip";

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  TooltipPortal,
  SimpleTooltip,
};
