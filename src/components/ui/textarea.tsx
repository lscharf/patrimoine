"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 4, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "peer bg-surface-2 text-ink border-hairline flex w-full resize-y rounded-xl border px-3 py-2 text-sm",
        "transition-[border-color,box-shadow,background-color] duration-150 ease-out",
        "placeholder:text-ink-faint",
        "hover:border-hairline-strong",
        "focus-visible:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent/35 outline-none",
        "disabled:cursor-not-allowed disabled:opacity-45",
        "aria-invalid:border-negative/60 aria-invalid:focus-visible:ring-negative/30",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
