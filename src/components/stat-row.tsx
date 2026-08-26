import { Montant } from "@/components/privacy/amount";
import { SimpleTooltip } from "@/components/ui";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PortfolioSnapshot } from "@/server/portfolio/types";

function Stat({
  label,
  value,
  apres,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  /** Rendu hors du masque : sert au pourcentage, qui reste lisible. */
  apres?: string;
  hint?: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  const body = (
    <div className="rounded-card border border-hairline bg-surface px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
        {label}
      </p>
      <p
        className={cn(
          "tnum mt-1.5 text-lg font-semibold tracking-tight",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-negative",
          tone === "neutral" && "text-ink",
        )}
      >
        <Montant>{value}</Montant>
        {apres && <span className="text-ink-muted">{apres}</span>}
      </p>
    </div>
  );

  return hint ? (
    <SimpleTooltip label={hint}>
      <div className="cursor-help">{body}</div>
    </SimpleTooltip>
  ) : (
    body
  );
}

function tone(v: number) {
  if (Math.abs(v) < 0.005) return "neutral" as const;
  return v > 0 ? ("positive" as const) : ("negative" as const);
}

export function StatRow({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const invested = snapshot.totalCostBasis;

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Stat
        label="Investi"
        value={formatCurrency(invested)}
        hint="Somme de vos achats et versements, frais inclus, convertie au taux de change du jour de chaque opération."
      />
      <Stat
        label="+/- value latente"
        value={formatCurrency(snapshot.unrealizedPL)}
        apres={` · ${formatPercent(
          snapshot.unrealizedPLPct,
        )}`}
        tone={tone(snapshot.unrealizedPL)}
        hint="Écart entre la valeur actuelle et le prix de revient des lignes que vous détenez encore."
      />
      <Stat
        label="Réalisé"
        value={formatCurrency(snapshot.realizedPL)}
        tone={tone(snapshot.realizedPL)}
        hint="Plus ou moins-values encaissées lors de vos ventes passées."
      />
      <Stat
        label="Dividendes"
        value={formatCurrency(snapshot.dividends)}
        hint="Total des dividendes et coupons perçus depuis l'origine."
      />
      <Stat
        label="Frais"
        value={formatCurrency(snapshot.fees)}
        hint="Frais de courtage et de tenue de compte supportés depuis l'origine."
      />
    </section>
  );
}
