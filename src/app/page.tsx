import { Plus } from "lucide-react";
import Link from "next/link";
import { AllocationPanel } from "@/components/allocation-panel";
import { HoldingsTable } from "@/components/holdings-table";
import { PortfolioSummary } from "@/components/portfolio-summary";
import { SiteHeader } from "@/components/site-header";
import { parseRange } from "@/lib/range";
import { Button, EmptyState } from "@/components/ui";
import { Montant } from "@/components/privacy/amount";
import { formatCurrency } from "@/lib/format";
import type { Slice } from "@/components/chart/allocation-donut";
import { getHistory, getSnapshot } from "@/server/queries";
import { StatRow } from "@/components/stat-row";
import { Wallet } from "lucide-react";
/** Palette de repli quand plusieurs lignes partagent la couleur d'un compte. */
const CHART_COLORS = Array.from(
  { length: 8 },
  (_, i) => `var(--color-chart-${i + 1})`,
);

export default async function DashboardPage({
  searchParams,
}: PageProps<"/">) {
  const params = await searchParams;
  const range = parseRange(params.p);

  const snapshot = await getSnapshot();
  const history = await getHistory(range);

  if (snapshot.holdings.length === 0) {
    return (
      <>
        <SiteHeader active="/" />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
          <EmptyState
            icon={<Wallet className="size-6" aria-hidden />}
            title="Votre patrimoine est vide"
            description="Créez un premier compte — PEA, compte-titres, crypto, livret — puis ajoutez-y vos lignes pour suivre leur performance."
            action={
              <Button asChild>
                <Link href="/comptes">
                  <Plus className="size-4" aria-hidden />
                  Créer un compte
                </Link>
              </Button>
            }
          />
        </main>
      </>
    );
  }

  const byHolding: Slice[] = snapshot.holdings.map((h, i) => ({
    id: h.id,
    label: h.label,
    value: h.value,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const byAccount: Slice[] = snapshot.accounts.map((a) => ({
    id: `a${a.id}`,
    label: a.name,
    value: a.value,
    color: a.color,
  }));

  return (
    <>
      <SiteHeader active="/" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        {snapshot.totalLiabilities > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-card border border-hairline bg-surface p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                Patrimoine Net
              </p>
              <p className="tnum mt-1 text-2xl font-bold tracking-tight text-ink">
                <Montant>{formatCurrency(snapshot.netWorth)}</Montant>
              </p>
              <p className="mt-1 text-xs text-ink-muted">Actifs bruts − Dettes</p>
            </div>
            <div className="rounded-card border border-hairline bg-surface p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                Actifs bruts
              </p>
              <p className="tnum mt-1 text-2xl font-bold tracking-tight text-ink">
                <Montant>{formatCurrency(snapshot.grossAssets)}</Montant>
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {snapshot.holdings.length} ligne{snapshot.holdings.length > 1 ? "s" : ""}
              </p>
            </div>
            <Link
              href="/emprunts"
              className="group rounded-card border border-hairline bg-surface p-4 transition-colors hover:border-hairline-strong"
            >
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint group-hover:text-accent transition-colors">
                Passif / Dettes →
              </p>
              <p className="tnum mt-1 text-2xl font-bold tracking-tight text-negative">
                <Montant>{formatCurrency(snapshot.totalLiabilities)}</Montant>
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {snapshot.loansCount} emprunt{snapshot.loansCount > 1 ? "s" : ""}
              </p>
            </Link>
            <div className="rounded-card border border-hairline bg-surface p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                Mensualités
              </p>
              <p className="tnum mt-1 text-2xl font-bold tracking-tight text-ink">
                <Montant>{formatCurrency(snapshot.monthlyLoanPayment)}</Montant>
                <span className="text-xs font-normal text-ink-muted"> /m</span>
              </p>
              <p className="mt-1 text-xs text-ink-muted">Crédits en cours</p>
            </div>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
          <PortfolioSummary
            title="Patrimoine financier"
            total={snapshot.totalValue}
            history={history}
            range={range}
          />
          <aside className="min-w-0 rounded-card border border-hairline bg-surface p-5 sm:p-6">
            <AllocationPanel
              byHolding={byHolding}
              byAccount={byAccount}
              total={snapshot.totalValue}
            />
          </aside>
        </div>
        <StatRow snapshot={snapshot} />

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-ink">
              Vos lignes
              <span className="tnum ml-2 text-ink-faint">
                {snapshot.holdings.length}
              </span>
            </h2>
            <Button asChild variant="secondary" size="sm">
              <Link href="/comptes">Gérer les comptes</Link>
            </Button>
          </div>
          <HoldingsTable
            holdings={snapshot.holdings}
            periodChanges={history.byHolding}
            rangeLabel={range}
            total={snapshot.totalValue}
          />
        </section>
      </main>
    </>
  );
}
