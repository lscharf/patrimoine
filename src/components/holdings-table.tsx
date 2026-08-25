"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { DeltaBadge } from "@/components/delta-badge";
import { formatCurrency, formatPercent, formatPrice, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HoldingPeriodChange, HoldingSnapshot } from "@/server/portfolio/types";

const TYPE_LABELS: Record<string, string> = {
  ETF: "ETF",
  EQUITY: "Action",
  CRYPTOCURRENCY: "Crypto",
  MUTUALFUND: "Fonds",
  INDEX: "Indice",
};

/**
 * Grille partagée par l'en-tête et les lignes.
 *
 * `minmax(0,…)` sur chaque colonne est indispensable : sans lui, une colonne
 * prend la largeur de son contenu le plus long et pousse le tableau au-delà
 * de l'écran sur mobile.
 */
const GRID =
  "sm:grid sm:grid-cols-[minmax(0,2.1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_16px] sm:items-center sm:gap-4";

type SortKey = "nom" | "repartition" | "valeur" | "plusvalue" | "periode";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "nom", label: "Nom", align: "left" },
  { key: "repartition", label: "Répartition", align: "left" },
  { key: "valeur", label: "Valeur", align: "right" },
  { key: "plusvalue", label: "+/- value", align: "right" },
];

function TypeChip({ holding }: { holding: HoldingSnapshot }) {
  const label =
    holding.kind === "MANUAL"
      ? "Non coté"
      : (TYPE_LABELS[holding.instrumentType ?? ""] ?? "Titre");
  return (
    <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
      {label}
    </span>
  );
}

function SortButton({
  label,
  active,
  direction,
  align,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  align: "left" | "right";
  onClick: () => void;
}) {
  const Icon = direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      // `aria-sort` appartient à l'en-tête de colonne, pas au bouton. La table
      // n'étant pas un `<table>`, on décrit l'état dans le libellé accessible.
      aria-label={
        active
          ? `${label} — tri ${direction === "asc" ? "croissant" : "décroissant"}, cliquer pour inverser`
          : `Trier par ${label}`
      }
      className={cn(
        "group inline-flex items-center gap-1 rounded transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
        align === "right" && "flex-row-reverse",
        active ? "text-ink" : "text-ink-faint",
      )}
    >
      {label}
      <Icon
        className={cn(
          "size-3 transition-opacity",
          active ? "opacity-100" : "opacity-0 group-hover:opacity-40",
        )}
        aria-hidden
      />
    </button>
  );
}

export function HoldingsTable({
  holdings,
  periodChanges = [],
  rangeLabel,
  total,
  showAccount = true,
  emptyLabel = "Aucune ligne pour l'instant.",
}: {
  holdings: HoldingSnapshot[];
  periodChanges?: HoldingPeriodChange[];
  rangeLabel: string;
  total: number;
  showAccount?: boolean;
  emptyLabel?: string;
}) {
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "valeur",
    direction: "desc",
  });

  const periodById = useMemo(
    () => new Map(periodChanges.map((p) => [p.holdingId, p])),
    [periodChanges],
  );

  const rows = useMemo(() => {
    const sign = sort.direction === "asc" ? 1 : -1;
    const value = (h: HoldingSnapshot) => {
      switch (sort.key) {
        case "nom":
          return h.label;
        // La répartition est proportionnelle à la valeur : même tri, mais la
        // colonne reste cliquable là où l'utilisateur la regarde.
        case "repartition":
        case "valeur":
          return h.value;
        case "plusvalue":
          return h.unrealizedPL;
        case "periode":
          return periodById.get(h.id)?.change ?? 0;
      }
    };
    return [...holdings].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (typeof va === "string" && typeof vb === "string") {
        return sign * va.localeCompare(vb, "fr");
      }
      return sign * ((va as number) - (vb as number));
    });
  }, [holdings, sort, periodById]);

  function toggle(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : // Un nom se lit de A à Z ; un montant, du plus gros au plus petit.
          { key, direction: key === "nom" ? "asc" : "desc" },
    );
  }

  if (holdings.length === 0) {
    return (
      <div className="rounded-card border border-hairline bg-surface px-6 py-14 text-center text-sm text-ink-faint">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-hairline bg-surface">
      {/* En-tête de tri. Sur mobile, seules deux clés tiennent : les autres
          restent accessibles en passant l'appareil en paysage. */}
      <div
        className={cn(
          GRID,
          "flex items-center justify-between gap-3 border-b border-hairline px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider sm:px-6",
        )}
      >
        {COLUMNS.map((c) => (
          <div
            key={c.key}
            className={cn(
              c.align === "right" && "sm:text-right",
              (c.key === "repartition" || c.key === "plusvalue") && "hidden sm:block",
            )}
          >
            <SortButton
              label={c.label}
              align={c.align}
              active={sort.key === c.key}
              direction={sort.key === c.key ? sort.direction : "desc"}
              onClick={() => toggle(c.key)}
            />
          </div>
        ))}
        <div className="sm:text-right">
          <SortButton
            label={`Var. ${rangeLabel}`}
            align="right"
            active={sort.key === "periode"}
            direction={sort.key === "periode" ? sort.direction : "desc"}
            onClick={() => toggle("periode")}
          />
        </div>
        <div className="hidden sm:block" />
      </div>

      <ul>
        {rows.map((h) => {
          const share = total > 0 ? h.value / total : 0;
          const period = periodById.get(h.id);
          return (
            <li key={h.id} className="border-b border-hairline last:border-0">
              <Link
                href={`/lignes/${h.id}`}
                className={cn(
                  GRID,
                  "flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none sm:gap-4 sm:px-6 sm:py-3.5",
                )}
              >
                {/* Nom — première ligne sur mobile, première colonne au-delà */}
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: h.accountColor }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-ink">
                        {h.label}
                      </span>
                      {h.stale && (
                        <span
                          className="size-1.5 shrink-0 rounded-full bg-ink-faint"
                          title="Cours non rafraîchi"
                          aria-label="Cours non rafraîchi"
                        />
                      )}
                    </div>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-ink-faint">
                      <TypeChip holding={h} />
                      {showAccount && <span className="truncate">{h.accountName}</span>}
                      {h.kind === "QUOTED" && h.quantity > 0 && (
                        <span className="tnum hidden truncate lg:inline">
                          {formatQuantity(h.quantity)} × {formatPrice(h.lastPrice, h.currency)}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Valeur, collée au nom sur mobile pour tenir sur une ligne */}
                  <span className="tnum shrink-0 text-sm font-medium text-ink sm:hidden">
                    {formatCurrency(h.value)}
                  </span>
                </div>

                {/* `sm:contents` dissout ce conteneur dans la grille : une seule
                    écriture du balisage sert les deux dispositions. */}
                <div className="flex items-center justify-between gap-2 sm:contents">
                  <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none sm:gap-2.5">
                    <div className="hidden h-1 w-full max-w-20 overflow-hidden rounded-full bg-surface-3 sm:block">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(share * 100, 1.5)}%`,
                          backgroundColor: h.accountColor,
                        }}
                      />
                    </div>
                    <span className="tnum shrink-0 text-xs text-ink-muted">
                      {formatPercent(share)}
                    </span>
                  </div>

                  <div className="hidden text-right sm:block">
                    <div className="tnum text-sm font-medium text-ink">
                      {formatCurrency(h.value)}
                    </div>
                    {h.currency !== "EUR" && h.lastPrice != null && (
                      <div className="tnum mt-0.5 text-[11px] text-ink-faint">
                        {formatCurrency(h.quantity * h.lastPrice, h.currency)}
                      </div>
                    )}
                  </div>

                  {/* Sur mobile les deux badges cohabitent : la +/- value
                      depuis l'achat, puis la variation de la période choisie.
                      Seule la seconde réagit au sélecteur. */}
                  <div className="flex justify-end">
                    <DeltaBadge
                      value={h.unrealizedPL}
                      pct={h.unrealizedPLPct}
                      pctOnly
                      className="sm:hidden"
                    />
                    <DeltaBadge
                      value={h.unrealizedPL}
                      pct={h.unrealizedPLPct}
                      className="hidden sm:inline-flex"
                    />
                  </div>

                  <div className="flex justify-end">
                    {period ? (
                      <DeltaBadge value={period.change} pct={period.changePct} />
                    ) : (
                      <span className="text-xs text-ink-faint">—</span>
                    )}
                  </div>
                </div>

                <ChevronRight
                  className="hidden size-4 text-ink-faint sm:block"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
