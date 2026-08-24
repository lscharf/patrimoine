import * as React from "react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Icône (ex. un composant `lucide-react`). */
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Bouton d'action facultatif, aligné sous la description. */
  action?: React.ReactNode;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center px-6 py-14 text-center",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div
          className={cn(
            "bg-surface-2 border-hairline text-ink-faint mb-4",
            "flex size-11 items-center justify-center rounded-2xl border",
            "[&_svg]:size-5",
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
      <p className="text-ink text-sm font-medium">{title}</p>
      {description ? (
        <p className="text-ink-muted mt-1.5 max-w-sm text-[13px] leading-relaxed">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  ),
);
EmptyState.displayName = "EmptyState";

export { EmptyState };
