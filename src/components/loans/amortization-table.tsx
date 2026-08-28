"use client";

import * as React from "react";
import { Montant } from "@/components/privacy/amount";
import { Button } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import type { AmortizationScheduleRow } from "@/server/loans/types";

interface AmortizationTableProps {
  schedule: AmortizationScheduleRow[];
  paidInstallmentsCount: number;
}

export function AmortizationTable({
  schedule,
  paidInstallmentsCount,
}: AmortizationTableProps) {
  const [showAll, setShowAll] = React.useState(false);

  // Par défaut, afficher les 12 prochaines échéances ou les 12 autour de l'échéance courante
  const displayLimit = showAll ? schedule.length : 12;

  const startIndex = Math.max(
    0,
    Math.min(
      Math.max(0, paidInstallmentsCount - 2),
      Math.max(0, schedule.length - displayLimit),
    ),
  );
  const displayedRows = showAll
    ? schedule
    : schedule.slice(startIndex, startIndex + displayLimit);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Échéancier complet ({schedule.length} mensualités)
        </h4>
        <div className="flex items-center gap-2">
          {schedule.length > 12 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="h-7 text-xs"
            >
              {showAll ? "Réduire" : `Voir les ${schedule.length} échéances`}
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-hairline bg-surface/50">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-hairline bg-surface-muted/50 text-ink-faint">
              <th className="px-3 py-2 font-medium">N°</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 text-right font-medium">Mensualité</th>
              <th className="px-3 py-2 text-right font-medium">Capital</th>
              <th className="px-3 py-2 text-right font-medium">Intérêts</th>
              <th className="px-3 py-2 text-right font-medium">Assurance</th>
              <th className="px-3 py-2 text-right font-medium">Restant dû</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {displayedRows.map((row) => {
              const isPaid = row.installmentNumber <= paidInstallmentsCount;
              const isNext =
                row.installmentNumber === paidInstallmentsCount + 1;

              return (
                <tr
                  key={row.installmentNumber}
                  className={`transition-colors ${
                    isNext
                      ? "bg-accent/10 font-medium text-ink"
                      : isPaid
                        ? "text-ink-muted hover:bg-surface-muted/30"
                        : "text-ink hover:bg-surface-muted/30"
                  }`}
                >
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      {row.installmentNumber}
                      {isNext && (
                        <span className="size-1.5 rounded-full bg-accent" />
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(row.date).toLocaleDateString("fr-FR", {
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="tnum px-3 py-2 text-right font-medium">
                    <Montant>{formatCurrency(row.totalPayment)}</Montant>
                  </td>
                  <td className="tnum px-3 py-2 text-right text-[#60a5fa]">
                    <Montant>{formatCurrency(row.principalPayment)}</Montant>
                  </td>
                  <td className="tnum px-3 py-2 text-right text-[#f472b6]">
                    <Montant>{formatCurrency(row.interestPayment)}</Montant>
                  </td>
                  <td className="tnum px-3 py-2 text-right text-ink-faint">
                    {row.insurancePayment > 0 ? (
                      <Montant>{formatCurrency(row.insurancePayment)}</Montant>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="tnum px-3 py-2 text-right font-medium text-ink">
                    <Montant>{formatCurrency(row.remainingPrincipal)}</Montant>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
