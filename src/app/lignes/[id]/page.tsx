import Link from "next/link";
import { Montant } from "@/components/privacy/amount";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, Settings, Trash2 } from "lucide-react";
import {
  DeleteConfirm,
  HoldingDialog,
  ManualValueDialog,
  TransactionDialog,
} from "@/components/forms";
import { PortfolioSummary } from "@/components/portfolio-summary";
import { TransactionsTable } from "@/components/transactions-table";
import { SiteHeader } from "@/components/site-header";
import { parseRange } from "@/lib/range";
import { Button } from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  formatPercent,
  formatPrice,
  formatQuantity,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { deleteHolding } from "@/server/actions";
import { getHistory, getHoldingDetail } from "@/server/queries";

function Metric({
  label,
  value,
  apres,
  tone,
}: {
  label: string;
  value: string;
  /** Rendu hors du masque : le pourcentage reste lisible. */
  apres?: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="rounded-card border border-hairline bg-surface px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
        {label}
      </p>
      <p
        className={cn(
          "tnum mt-1.5 text-base font-semibold tracking-tight",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-negative",
          !tone && "text-ink",
        )}
      >
        <Montant>{value}</Montant>
        {apres && <span className="text-ink-muted">{apres}</span>}
      </p>
    </div>
  );
}

export default async function HoldingPage({
  params,
  searchParams,
}: PageProps<"/lignes/[id]">) {
  const { id } = await params;
  const holdingId = Number(id);
  if (!Number.isInteger(holdingId)) notFound();

  const detail = await getHoldingDetail(holdingId);
  if (!detail) notFound();

  const { holding: h, transactions, valuations } = detail;
  const range = parseRange((await searchParams).p);
  const history = await getHistory(range, { holdingId });

  const tone = (v: number) =>
    Math.abs(v) < 0.005 ? undefined : v > 0 ? ("positive" as const) : ("negative" as const);

  return (
    <>
      <SiteHeader active="/comptes" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/comptes/${h.accountId}`}
            className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {h.accountName}
          </Link>

          <div className="flex items-center gap-2">
            <HoldingDialog
              accountId={h.accountId}
              accountName={h.accountName}
              initial={{
                id: h.id,
                label: h.label,
                note: h.note,
                symbol: h.symbol,
                kind: h.kind,
                currency: h.currency,
              }}
              trigger={
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Settings className="size-3.5" aria-hidden />
                  <span>Modifier le ticker / ligne</span>
                </Button>
              }
            />
            {h.kind === "MANUAL" && (
              <ManualValueDialog
                holdingId={h.id}
                trigger={
                  <Button size="sm" variant="secondary">
                    Mettre à jour la valorisation
                  </Button>
                }
              />
            )}
            <TransactionDialog
              holdingId={h.id}
              currency={h.currency}
              kind={h.kind}
              trigger={
                <Button size="sm">
                  <Plus className="size-4" aria-hidden />
                  {h.kind === "MANUAL" ? "Versement" : "Transaction"}
                </Button>
              }
            />
            <DeleteConfirm
              title={`Supprimer « ${h.label} » ?`}
              description="Cette ligne et toutes ses transactions seront définitivement supprimées."
              confirmLabel="Supprimer la ligne"
              onConfirm={async () => {
                "use server";
                return deleteHolding(h.id);
              }}
              redirectTo={`/comptes/${h.accountId}`}
              trigger={
                <Button size="icon" variant="ghost" aria-label="Supprimer la ligne">
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              }
            />
          </div>
        </div>

        <PortfolioSummary
          title={h.symbol ? `${h.label} · ${h.symbol}` : h.label}
          total={h.value}
          history={history}
          range={range}
        />

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {h.kind === "QUOTED" ? (
            <>
              <Metric label="Quantité" value={formatQuantity(h.quantity)} />
              <Metric label="PRU" value={formatPrice(h.avgCost, h.currency)} />
              <Metric
                label="Cours actuel"
                value={formatPrice(h.lastPrice, h.currency)}
              />
              <Metric
                label="Variation du jour"
                value={
                  h.dayChange != null
                    ? formatCurrency(h.dayChange)
                    : "—"
                }
                apres={
                  h.dayChange != null ? ` · ${formatPercent(h.dayChangePct)}` : undefined
                }
                tone={h.dayChange != null ? tone(h.dayChange) : undefined}
              />
            </>
          ) : (
            <>
              <Metric label="Valorisation" value={formatCurrency(h.value)} />
              <Metric label="Versements" value={formatCurrency(h.costBasis)} />
              <Metric
                label="Gain"
                value={formatCurrency(h.unrealizedPL)}
                tone={tone(h.unrealizedPL)}
              />
              <Metric
                label="Performance"
                value={formatPercent(h.unrealizedPLPct)}
                tone={tone(h.unrealizedPL)}
              />
            </>
          )}
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Investi" value={formatCurrency(h.costBasis)} />
          <Metric
            label="+/- value latente"
            value={formatCurrency(h.unrealizedPL)}
            apres={` · ${formatPercent(h.unrealizedPLPct)}`}
            tone={tone(h.unrealizedPL)}
          />
          <Metric
            label="Réalisé"
            value={formatCurrency(h.realizedPL)}
            tone={tone(h.realizedPL)}
          />
          <Metric label="Dividendes" value={formatCurrency(h.dividends)} />
        </section>

        {h.kind === "MANUAL" && valuations.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-ink">Valorisations saisies</h2>
            <div className="overflow-hidden rounded-card border border-hairline bg-surface">
              <ul>
                {valuations.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between border-b border-hairline px-4 py-3 last:border-0 sm:px-6"
                  >
                    <span className="tnum text-sm text-ink-muted">
                      {formatDate(v.date)}
                    </span>
                    <span className="tnum text-sm font-medium text-ink">
                      {<Montant>{formatCurrency(v.value)}</Montant>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-ink">
            Transactions
            <span className="tnum ml-2 text-ink-faint">{transactions.length}</span>
          </h2>
          <TransactionsTable
            rows={transactions.map((tx) => ({
              tx,
              currency: h.currency,
              holdingKind: h.kind,
            }))}
            emptyLabel="Aucune transaction enregistrée sur cette ligne."
          />
        </section>
      </main>
    </>
  );
}
