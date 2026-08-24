"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "border-hairline flex items-center gap-6 border-b",
      "data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
      "data-[orientation=vertical]:border-b-0 data-[orientation=vertical]:border-l",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "group text-ink-muted relative -mb-px inline-flex items-center gap-2",
      "px-0.5 pb-3 text-sm font-medium whitespace-nowrap",
      "transition-colors duration-150 ease-out",
      "hover:text-ink",
      "data-[state=active]:text-ink",
      "focus-visible:ring-accent/70 focus-visible:ring-offset-canvas rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-4",
      "disabled:pointer-events-none disabled:opacity-45",
      // Barre d'accent sous l'onglet actif.
      "after:bg-accent after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full",
      "after:scale-x-0 after:opacity-0 after:transition-[transform,opacity] after:duration-200 after:ease-out",
      "data-[state=active]:after:scale-x-100 data-[state=active]:after:opacity-100",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "focus-visible:ring-accent/70 mt-5 outline-none focus-visible:ring-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
