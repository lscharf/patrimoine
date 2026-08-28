import Link from "next/link";
import { ChevronRight, CreditCard } from "lucide-react";
import { Montant } from "@/components/privacy/amount";
import { Badge } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { LOAN_TYPE_LABELS, type LoanSummary } from "@/server/loans/types";

export function LoanCard({ loan }: { loan: LoanSummary }) {
  const isFinished = loan.currentRemainingCapital <= 0;

  const endDateFormatted = loan.endDate
    ? new Date(loan.endDate).toLocaleDateString("fr-FR", {
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <Link
      href={`/emprunts/${loan.id}`}
      className="group relative flex flex-col justify-between rounded-card border border-hairline bg-surface p-5 transition-all hover:border-hairline-strong hover:bg-surface-elevated"
    >
      <div>
        {/* En-tête de la carte */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <CreditCard className="size-5" aria-hidden />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-ink group-hover:text-accent transition-colors">
                {loan.name}
              </h3>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <Badge variant="neutral" className="text-[10px] px-1.5 py-0">
                  {LOAN_TYPE_LABELS[loan.type] ?? loan.type}
                </Badge>
                {loan.linkedAccountName && (
                  <Badge variant="accent" className="text-[10px] px-1.5 py-0">
                    {loan.linkedAccountName}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <ChevronRight
            className="size-4 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
            aria-hidden
          />
        </div>

        {/* Chiffres clés */}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-hairline pt-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
              Capital restant dû
            </p>
            <p className="tnum mt-1 text-xl font-bold tracking-tight text-ink">
              <Montant>{formatCurrency(loan.currentRemainingCapital)}</Montant>
            </p>
          </div>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
              Mensualité
            </p>
            <p className="tnum mt-1 text-xl font-bold tracking-tight text-ink">
              <Montant>{formatCurrency(loan.monthlyPayment)}</Montant>
              <span className="text-xs font-normal text-ink-faint">/m</span>
            </p>
          </div>
        </div>
      </div>

      {/* Barre de progression & échéances */}
      <div className="mt-5 space-y-2 border-t border-hairline pt-3 text-xs">
        <div className="flex items-center justify-between text-ink-muted">
          <span>
            {isFinished
              ? "Prêt soldé"
              : `${loan.remainingInstallments} mois restant${loan.remainingInstallments > 1 ? "s" : ""}`}
          </span>
          <span className="tnum font-medium text-ink">
            {loan.reimbursedPct.toFixed(1).replace(".", ",")}% remboursé
          </span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${Math.min(100, Math.max(0, loan.reimbursedPct))}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-ink-faint">
          <span>Taux : {loan.interestRate}%</span>
          <span>Fin : {endDateFormatted}</span>
        </div>
      </div>
    </Link>
  );
}
