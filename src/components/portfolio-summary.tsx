import { PortfolioChart } from "@/components/chart/portfolio-chart";
import { DeltaBadge, deltaTrend } from "@/components/delta-badge";
import { RangeSelector } from "@/components/range-selector";
import { SimpleTooltip } from "@/components/ui";
import { Montant } from "@/components/privacy/amount";
import { formatCurrency } from "@/lib/format";
import { RANGE_LABELS, type HistorySeries, type Range } from "@/server/portfolio/types";
import { Info } from "lucide-react";

export function PortfolioSummary({
  title,
  total,
  history,
  range,
}: {
  title: string;
  total: number;
  history: HistorySeries;
  range: Range;
}) {
  const trend = deltaTrend(history.change);

  // `min-w-0` sur la section : sans lui, un enfant de grille conserve
  // `min-width: auto` et refuse de descendre sous la largeur de son contenu,
  // ce qui pousse la page hors de l'écran sur mobile.
  return (
    <section className="min-w-0 rounded-card border border-hairline bg-surface p-5 sm:p-6">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
            {title}
          </p>
          <p className="tnum mt-2 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            <Montant>{formatCurrency(total)}</Montant>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <DeltaBadge value={history.change} pct={history.changePct} />
            <span className="text-sm text-ink-muted">{RANGE_LABELS[range]}</span>

            {/* Un versement n'est pas une performance : on le signale. */}
            {Math.abs(history.netFlows) >= 1 && (
              <SimpleTooltip
                label={`${formatCurrency(Math.abs(history.netFlows))} ${
                  history.netFlows > 0 ? "versés" : "retirés"
                } sur la période. Cette somme est exclue du calcul de performance.`}
              >
                <span className="inline-flex cursor-help items-center gap-1 text-xs text-ink-faint">
                  <Info className="size-3" aria-hidden />
                  hors apports
                </span>
              </SimpleTooltip>
            )}
          </div>
        </div>

        {/* Huit périodes ne tiennent pas sur 375 px : on laisse défiler. */}
        <div className="-mx-1 w-full max-w-full overflow-x-auto px-1 scrollbar-none sm:mx-0 sm:w-auto sm:px-0">
          <RangeSelector value={range} />
        </div>
      </div>

      <div className="mt-6 h-[260px] sm:h-[300px]">
        <PortfolioChart
          points={history.points}
          baseline={history.points.length > 1 ? history.startValue : undefined}
          intraday={history.isIntraday}
          trend={trend}
          className="h-full"
        />
      </div>
    </section>
  );
}
