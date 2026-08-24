"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui";
import { RANGES, type Range } from "@/server/portfolio/types";
import { cn } from "@/lib/utils";

/**
 * La fenêtre choisie vit dans l'URL : le graphique est recalculé côté serveur,
 * et l'état survit au rechargement comme au partage du lien.
 */
export function RangeSelector({
  value,
  className,
}: {
  value: Range;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function select(next: string) {
    // Radix émet une valeur vide quand on reclique l'élément actif.
    if (!next || next === value) return;
    const params = new URLSearchParams(searchParams);
    params.set("p", next);
    startTransition(() => {
      router.replace(`${pathname}?${params}`, { scroll: false });
    });
  }

  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={select}
      aria-label="Période affichée"
      className={cn(pending && "opacity-60", "transition-opacity", className)}
    >
      {RANGES.map((r) => (
        <ToggleGroupItem key={r} value={r} aria-label={`Période ${r}`}>
          {r}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
