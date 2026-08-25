"use client";

import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Sélecteur de plage temporelle (1J / 7J / 1M / 3M / 6M / YTD / 1A / TOUT).
 * Conteneur en pilule sur `surface-2`, l'élément actif reçoit une pastille
 * `surface-3` surélevée.
 */

const toggleGroupItemVariants = cva(
  [
    "inline-flex items-center justify-center rounded-lg",
    "font-medium tracking-wide whitespace-nowrap",
    "text-ink-muted",
    "transition-[background-color,color,box-shadow] duration-150 ease-out",
    "hover:text-ink",
    "outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-2",
    "disabled:pointer-events-none disabled:opacity-45",
    "data-[state=on]:bg-surface-3 data-[state=on]:text-ink data-[state=on]:shadow-elevated",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "h-6 px-1.5 text-[11px] sm:px-2",
        // Huit plages doivent tenir sur 390 px : on resserre sous `sm`.
        md: "h-7 px-1.5 text-[11px] sm:px-2.5 sm:text-[12px]",
        lg: "h-9 px-3 text-[12px] sm:px-3.5 sm:text-[13px]",
      },
    },
    defaultVariants: { size: "md" },
  },
);

type ToggleGroupSize = NonNullable<
  VariantProps<typeof toggleGroupItemVariants>["size"]
>;

const ToggleGroupContext = React.createContext<{ size: ToggleGroupSize }>({
  size: "md",
});

type ToggleGroupProps = React.ComponentPropsWithoutRef<
  typeof ToggleGroupPrimitive.Root
> &
  VariantProps<typeof toggleGroupItemVariants>;

const ToggleGroup = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Root>,
  ToggleGroupProps
>(({ className, size = "md", children, ...props }, ref) => (
  <ToggleGroupContext.Provider value={{ size: size ?? "md" }}>
    <ToggleGroupPrimitive.Root
      ref={ref}
      className={cn(
        "bg-surface-2 border-hairline inline-flex w-fit items-center gap-0.5 rounded-xl border p-0.5",
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Root>
  </ToggleGroupContext.Provider>
));
ToggleGroup.displayName = "ToggleGroup";

const ToggleGroupItem = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof toggleGroupItemVariants>
>(({ className, size, children, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext);
  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleGroupItemVariants({ size: size ?? context.size }),
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
});
ToggleGroupItem.displayName = "ToggleGroupItem";

export { ToggleGroup, ToggleGroupItem, toggleGroupItemVariants };
