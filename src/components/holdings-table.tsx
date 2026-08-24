import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DeltaBadge } from "@/components/delta-badge";
import { formatCurrency, formatPercent, formatPrice, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HoldingSnapshot } from "@/server/portfolio/types";

const TYPE_LABELS: Record<string, string> = {
  ETF: "ETF",
  EQUITY: "Action",
  CRYPTOCURRENCY: "Crypto",
  MUTUALFUND: "Fonds",
  INDEX: "Indice",
};

/** Ligne / en-tête partagent la même grille pour rester alignés. */
const GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_16px] sm:gap-6";

function TypeChip({ holding }: { holding: HoldingSnapshot }) {
  const label =
    holding.kind === "MANUAL"
      ? "Non coté"
      : (TYPE_LABELS[holding.instrumentType ?? ""] ?? "Titre");
  return (
    <span className="inline-flex rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-muted">
      {label}
    </span>
  );
}

export function HoldingsTable({
  holdings,
  total,
  /** Masque la colonne du compte quand on est déjà dans le détail d'un compte */
  showAccount = true,
  emptyLabel = "Aucune ligne pour l'instant.",
}: {
  holdings: HoldingSnapshot[];
  total: number;
  showAccount?: boolean;
  emptyLabel?: string;
}) {
  if (holdings.length === 0) {
    return (
      <div className="rounded-card border border-hairline bg-surface px-6 py-14 text-center text-sm text-ink-faint">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-hairline bg-surface">
      <div
        className={cn(
          GRID,
          "border-b border-hairline px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-ink-faint sm:px-6",
        )}
      >
        <div>Nom</div>
        <div className="hidden sm:block">Répartition</div>
        <div className="hidden text-right sm:block">Valeur</div>
        <div className="text-right">+/- value</div>
        <div className="hidden sm:block" />
      </div>

      <ul>
        {holdings.map((h) => {
          const share = total > 0 ? h.value / total : 0;
          return (
            <li key={h.id} className="border-b border-hairline last:border-0">
              <Link
                href={`/lignes/${h.id}`}
                className={cn(
                  GRID,
                  "px-4 py-3.5 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none sm:px-6",
                )}
              >
                {/* Nom */}
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: h.accountColor }}
                    aria-hidden
                  />
                  <div className="min-w-0">
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
                    <div className="mt-0.5 flex items-center gap-2 truncate text-xs text-ink-faint">
                      <TypeChip holding={h} />
                      {showAccount && <span className="truncate">{h.accountName}</span>}
                      {h.kind === "QUOTED" && h.quantity > 0 && (
                        <span className="tnum hidden truncate md:inline">
                          {formatQuantity(h.quantity)} ×{" "}
                          {formatPrice(h.lastPrice, h.currency)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Répartition */}
                <div className="hidden items-center gap-2.5 sm:flex">
                  <div className="h-1 w-full max-w-24 overflow-hidden rounded-full bg-surface-3">
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

                {/* Valeur */}
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

                {/* +/- value */}
                <div className="flex flex-col items-end gap-1">
                  <span className="tnum text-sm font-medium text-ink sm:hidden">
                    {formatCurrency(h.value)}
                  </span>
                  <DeltaBadge value={h.unrealizedPL} pct={h.unrealizedPLPct} />
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
