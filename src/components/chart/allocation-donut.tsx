"use client";

import { useState } from "react";
import { Group } from "@visx/group";
import { Pie } from "@visx/shape";
import { Montant } from "@/components/privacy/amount";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Slice = { id: string | number; label: string; value: number; color: string };

type Props = {
  slices: Slice[];
  total: number;
  size?: number;
  className?: string;
};

/**
 * Les parts sous ce seuil sont fusionnées : en dessous, l'arc fait moins d'un
 * pixel et le graphique devient illisible.
 */
const MIN_SHARE = 0.005;

export function AllocationDonut({ slices, total, size = 220, className }: Props) {
  const [active, setActive] = useState<string | number | null>(null);

  const significant = slices.filter((s) => s.value / (total || 1) >= MIN_SHARE);
  const rest = slices.filter((s) => s.value / (total || 1) < MIN_SHARE);
  const data: Slice[] =
    rest.length > 0
      ? [
          ...significant,
          {
            id: "__autre__",
            label: "Autre",
            value: rest.reduce((s, r) => s + r.value, 0),
            color: "var(--color-ink-faint)",
          },
        ]
      : significant;

  const radius = size / 2;
  const thickness = Math.max(14, size * 0.115);
  const hovered = data.find((d) => d.id === active) ?? null;

  if (total <= 0 || data.length === 0) {
    return (
      <div
        className={cn("flex items-center justify-center text-sm text-ink-faint", className)}
        style={{ height: size }}
      >
        Aucune répartition à afficher.
      </div>
    );
  }

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <Group top={radius} left={radius}>
          <Pie<Slice>
            data={data}
            pieValue={(d) => d.value}
            outerRadius={radius}
            innerRadius={radius - thickness}
            padAngle={0.012}
            cornerRadius={2}
          >
            {(pie) =>
              pie.arcs.map((arc) => {
                const isActive = active === arc.data.id;
                const isDimmed = active != null && !isActive;
                return (
                  <g
                    key={arc.data.id}
                    onMouseEnter={() => setActive(arc.data.id)}
                    onMouseLeave={() => setActive(null)}
                  >
                    <path
                      d={pie.path(arc) ?? undefined}
                      fill={arc.data.color}
                      opacity={isDimmed ? 0.3 : 1}
                      // Le groupe est déjà centré : la mise à l'échelle
                      // au survol se fait donc autour du centre du donut.
                      transform={isActive ? "scale(1.035)" : undefined}
                      className="transition-all duration-150 ease-out"
                    />
                  </g>
                );
              })
            }
          </Pie>
        </Group>
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <div className="tnum text-lg font-semibold tracking-tight text-ink">
          <Montant>
            {formatCurrency(hovered ? hovered.value : total, "EUR", { compact: size < 200 })}
          </Montant>
        </div>
        <div className="mt-0.5 max-w-full truncate text-xs text-ink-muted">
          {hovered ? hovered.label : "Total"}
        </div>
        {hovered && (
          <div className="tnum mt-0.5 text-[11px] text-ink-faint">
            {formatPercent(hovered.value / total)}
          </div>
        )}
      </div>
    </div>
  );
}
