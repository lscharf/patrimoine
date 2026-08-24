import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { DeleteConfirm, TransactionDialog } from "@/components/forms";
import { Button } from "@/components/ui";
import { formatCurrency, formatDate, formatPrice, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deleteTransaction } from "@/server/actions";
import { TX_TYPE_LABELS } from "@/server/actions/schemas";
import type { Transaction } from "@/db/schema";
import type { TxType } from "@/server/portfolio/types";

export type TransactionRow = {
  tx: Transaction;
  currency: string;
  holdingKind: "QUOTED" | "MANUAL";
  holdingLabel?: string;
  holdingId?: number;
  accountName?: string;
  accountColor?: string;
};

/** Un achat pèse sur le capital, une vente ou un dividende l'allège. */
function signedAmount(tx: Transaction): { value: number; tone: string } {
  switch (tx.type) {
    case "BUY":
      return { value: -(tx.quantity * tx.unitPrice + tx.fees), tone: "text-ink" };
    case "SELL":
      return { value: tx.quantity * tx.unitPrice - tx.fees, tone: "text-ink" };
    case "DIVIDEND":
      return { value: tx.amount, tone: "text-positive" };
    case "FEE":
      return { value: -tx.amount, tone: "text-negative" };
    case "DEPOSIT":
      return { value: -tx.amount, tone: "text-ink" };
    default:
      return { value: tx.amount, tone: "text-ink" };
  }
}

export function TransactionsTable({
  rows,
  showHolding = false,
  emptyLabel = "Aucune transaction.",
}: {
  rows: TransactionRow[];
  showHolding?: boolean;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-hairline bg-surface px-6 py-12 text-center text-sm text-ink-faint">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-hairline bg-surface">
      <ul>
        {rows.map(({ tx, currency, holdingKind, holdingLabel, holdingId, accountName, accountColor }) => {
          const amount = signedAmount(tx);
          const isTrade = tx.type === "BUY" || tx.type === "SELL";

          return (
            <li
              key={tx.id}
              className="group flex items-center gap-4 border-b border-hairline px-4 py-3 last:border-0 sm:px-6"
            >
              <div className="w-24 shrink-0">
                <span className="tnum text-xs text-ink-faint">
                  {formatDate(tx.date)}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">
                    {TX_TYPE_LABELS[tx.type as keyof typeof TX_TYPE_LABELS] ?? tx.type}
                  </span>
                  {showHolding && holdingLabel && (
                    <>
                      <span className="text-ink-faint" aria-hidden>
                        ·
                      </span>
                      {holdingId ? (
                        <Link
                          href={`/lignes/${holdingId}`}
                          className="truncate text-sm text-ink-muted transition-colors hover:text-ink"
                        >
                          {holdingLabel}
                        </Link>
                      ) : (
                        <span className="truncate text-sm text-ink-muted">
                          {holdingLabel}
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-faint">
                  {isTrade && (
                    <span className="tnum">
                      {formatQuantity(tx.quantity)} ×{" "}
                      {formatPrice(tx.unitPrice, currency)}
                      {tx.fees > 0 && ` · ${formatPrice(tx.fees, currency)} de frais`}
                    </span>
                  )}
                  {showHolding && accountName && (
                    <span className="flex items-center gap-1.5">
                      {accountColor && (
                        <span
                          className="size-1.5 rounded-full"
                          style={{ backgroundColor: accountColor }}
                          aria-hidden
                        />
                      )}
                      {accountName}
                    </span>
                  )}
                  {tx.note && <span className="truncate">{tx.note}</span>}
                </div>
              </div>

              <span className={cn("tnum shrink-0 text-sm font-medium", amount.tone)}>
                {formatCurrency(amount.value, currency)}
              </span>

              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <TransactionDialog
                  holdingId={tx.holdingId}
                  currency={currency}
                  kind={holdingKind}
                  // La colonne `type` est un TEXT côté SQLite ; le
                  // domaine réel est restreint à l'union TxType.
                  initial={{ ...tx, type: tx.type as TxType }}
                  trigger={
                    <Button size="icon" variant="ghost" aria-label="Modifier la transaction">
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                  }
                />
                <DeleteConfirm
                  title="Supprimer cette transaction ?"
                  description="Le prix de revient et la performance de la ligne seront recalculés en conséquence."
                  confirmLabel="Supprimer"
                  onConfirm={async () => {
                    "use server";
                    return deleteTransaction(tx.id);
                  }}
                  trigger={
                    <Button size="icon" variant="ghost" aria-label="Supprimer la transaction">
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  }
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
