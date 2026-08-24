import { SiteHeader } from "@/components/site-header";
import { TransactionsTable } from "@/components/transactions-table";
import { getRecentTransactions, getSnapshot } from "@/server/queries";

/**
 * Les cours et les valorisations changent en permanence : cette page ne
 * doit jamais être figée au moment du build.
 */
export const dynamic = "force-dynamic";


export default async function TransactionsPage() {
  const [rows, snapshot] = await Promise.all([
    getRecentTransactions(200),
    getSnapshot(),
  ]);

  const kindByHolding = new Map(snapshot.holdings.map((h) => [h.id, h.kind]));

  return (
    <>
      <SiteHeader active="/transactions" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            Transactions
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            L&apos;ensemble de vos opérations, tous comptes confondus.
          </p>
        </div>

        <TransactionsTable
          showHolding
          rows={rows.map((r) => ({
            tx: r.tx,
            currency: r.currency,
            holdingKind: kindByHolding.get(r.holdingId) ?? "QUOTED",
            holdingLabel: r.holdingLabel,
            holdingId: r.holdingId,
            accountName: r.accountName,
            accountColor: r.accountColor,
          }))}
          emptyLabel="Aucune transaction pour le moment."
        />
      </main>
    </>
  );
}
