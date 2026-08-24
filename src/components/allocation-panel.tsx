"use client";

import { useState } from "react";
import { AllocationDonut, type Slice } from "@/components/chart/allocation-donut";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui";
import { formatCurrency, formatPercent } from "@/lib/format";

type Props = {
  byHolding: Slice[];
  byAccount: Slice[];
  total: number;
};

/** Au-delà, la légende est repliée derrière une ligne « Autre ». */
const LEGEND_LIMIT = 7;

export function AllocationPanel({ byHolding, byAccount, total }: Props) {
  const [mode, setMode] = useState<"actif" | "compte">("actif");
  const slices = mode === "actif" ? byHolding : byAccount;

  const visible = slices.slice(0, LEGEND_LIMIT);
  const hidden = slices.slice(LEGEND_LIMIT);
  const hiddenValue = hidden.reduce((s, x) => s + x.value, 0);

  return (
    <div className="flex h-full flex-col">
      {/* Sous 400 px, le titre et les deux onglets ne tiennent pas sur une
          seule ligne : on les empile plutôt que de rogner « Par compte ». */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h2 className="shrink-0 text-sm font-medium text-ink">Répartition</h2>
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as "actif" | "compte")}
        >
          <TabsList>
            <TabsTrigger value="actif">Par actif</TabsTrigger>
            <TabsTrigger value="compte">Par compte</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-6 flex justify-center">
        <AllocationDonut slices={slices} total={total} size={196} />
      </div>

      <ul className="mt-6 space-y-2.5">
        {visible.map((s) => (
          <li key={s.id} className="flex items-center gap-3 text-sm">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-ink-muted">{s.label}</span>
            <span className="tnum shrink-0 text-xs text-ink-faint">
              {formatCurrency(s.value, "EUR", { compact: true })}
            </span>
            <span className="tnum w-12 shrink-0 text-right text-ink">
              {formatPercent(total > 0 ? s.value / total : 0)}
            </span>
          </li>
        ))}
        {hidden.length > 0 && (
          <li className="flex items-center gap-3 text-sm">
            <span
              className="size-2 shrink-0 rounded-full bg-ink-faint"
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-ink-muted">
              {hidden.length} autre{hidden.length > 1 ? "s" : ""}
            </span>
            <span className="tnum shrink-0 text-xs text-ink-faint">
              {formatCurrency(hiddenValue, "EUR", { compact: true })}
            </span>
            <span className="tnum w-12 shrink-0 text-right text-ink">
              {formatPercent(total > 0 ? hiddenValue / total : 0)}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}
