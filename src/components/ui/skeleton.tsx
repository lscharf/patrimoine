import * as React from "react";

import { cn } from "@/lib/utils";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

/** Bloc de chargement. L'animation est neutralisée si l'utilisateur a demandé
 *  une réduction des animations. */
function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-surface-2 animate-shimmer rounded-lg motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
