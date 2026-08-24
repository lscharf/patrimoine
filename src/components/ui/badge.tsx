import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1 rounded-full",
    "px-2 py-0.5 text-[11.5px] leading-5 font-medium whitespace-nowrap",
    "[&_svg]:size-2.5 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        neutral: "bg-surface-3 text-ink-muted",
        positive: "bg-positive-dim text-positive",
        negative: "bg-negative-dim text-negative",
        accent: "bg-accent-dim text-accent-soft",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Petit chevron / puce affiché avant le libellé (ex. `▲` sur un delta). */
  icon?: React.ReactNode;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, icon, children, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props}>
      {icon ? (
        <span className="flex items-center" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="tnum">{children}</span>
    </span>
  ),
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
