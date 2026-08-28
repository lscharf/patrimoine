import { Landmark, Plus, TrendingDown } from "lucide-react";
import { AmortizationChart } from "@/components/chart/amortization-chart";
import { LoanDialog } from "@/components/forms";
import { LoanCard } from "@/components/loans/loan-card";
import { Montant } from "@/components/privacy/amount";
import { SiteHeader } from "@/components/site-header";
import { Button, EmptyState } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { getAccounts, getLiabilities } from "@/server/queries";

export const dynamic = "force-dynamic";

export default async function LoansPage() {
  const [liabilities, accounts] = await Promise.all([
    getLiabilities(),
    getAccounts(),
  ]);

  const simpleAccounts = accounts.map((a) => ({ id: a.id, name: a.name }));

  return (
    <>
      <SiteHeader active="/emprunts" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* En-tête de la page */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Passif & Emprunts
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Suivi et amortissement de vos crédits immobiliers et personnels.
            </p>
          </div>

          <LoanDialog
            accounts={simpleAccounts}
            trigger={
              <Button className="shrink-0 gap-1.5 self-start sm:self-auto">
                <Plus className="size-4" aria-hidden />
                <span>Nouvel emprunt</span>
              </Button>
            }
          />
        </div>

        {liabilities.loans.length === 0 ? (
          <EmptyState
            icon={<Landmark className="size-6" aria-hidden />}
            title="Aucun emprunt enregistré"
            description="Ajoutez vos crédits immobiliers, prêts à la consommation ou PTZ pour suivre leur amortissement et déduire vos dettes du patrimoine net."
            action={
              <LoanDialog
                accounts={simpleAccounts}
                trigger={
                  <Button className="gap-1.5">
                    <Plus className="size-4" aria-hidden />
                    <span>Ajouter mon premier emprunt</span>
                  </Button>
                }
              />
            }
          />
        ) : (
          <>
            {/* Carte de synthèse globale du passif */}
            <section className="rounded-card border border-hairline bg-surface p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                    Capital restant dû total
                  </p>
                  <p className="tnum mt-2 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
                    <Montant>{formatCurrency(liabilities.totalRemainingCapital)}</Montant>
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
                    <span className="flex items-center gap-1.5 text-ink">
                      <TrendingDown className="size-4 text-accent" aria-hidden />
                      <span className="font-semibold">
                        <Montant>{formatCurrency(liabilities.totalMonthlyPayment)}</Montant>
                      </span>
                      <span className="text-xs text-ink-muted">/mois</span>
                    </span>
                    <span>·</span>
                    <span>
                      {liabilities.activeLoansCount} emprunt{liabilities.activeLoansCount > 1 ? "s" : ""} actif{liabilities.activeLoansCount > 1 ? "s" : ""}
                    </span>
                    {liabilities.averageInterestRate > 0 && (
                      <>
                        <span>·</span>
                        <span>Taux moyen : {liabilities.averageInterestRate}%</span>
                      </>
                    )}
                    <span>·</span>
                    <span>
                      Total remboursé :{" "}
                      <span className="text-positive font-medium">
                        <Montant>{formatCurrency(liabilities.totalPaidAmount)}</Montant>
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Courbe globale d'extinction du passif */}
              {liabilities.chartPoints.length > 1 && (
                <div className="mt-6 border-t border-hairline pt-6">
                  <div className="mb-2 flex items-center justify-between text-xs text-ink-muted">
                    <span>Courbe d&apos;amortissement globale</span>
                    <span>Projection de remboursement</span>
                  </div>
                  <div className="h-[220px] sm:h-[260px]">
                    <AmortizationChart
                      points={liabilities.chartPoints}
                      initialAmount={liabilities.totalBorrowedAmount}
                    />
                  </div>
                </div>
              )}
            </section>

            {/* Liste des emprunts */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink">
                  Vos crédits ({liabilities.loans.length})
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {liabilities.loans.map((loan) => (
                  <LoanCard key={loan.id} loan={loan} />
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
