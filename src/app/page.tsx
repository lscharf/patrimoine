import { Plus } from "lucide-react";
import Link from "next/link";
import { AllocationPanel } from "@/components/allocation-panel";
import { HoldingsTable } from "@/components/holdings-table";
import { PortfolioSummary } from "@/components/portfolio-summary";
import { SiteHeader } from "@/components/site-header";
import { parseRange } from "@/lib/range";
import { Button, EmptyState } from "@/components/ui";
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
