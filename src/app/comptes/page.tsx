import Link from "next/link";
import { ChevronRight, Plus, Wallet } from "lucide-react";
import { AccountDialog } from "@/components/forms";
import { DeltaBadge } from "@/components/delta-badge";
import { SiteHeader } from "@/components/site-header";
import { Button, EmptyState } from "@/components/ui";
import { formatCurrency, formatPercent } from "@/lib/format";
import { ACCOUNT_KIND_LABELS } from "@/server/actions/schemas";
import { getSnapshot } from "@/server/queries";

/**
 * Les cours et les valorisations changent en permanence : cette page ne
 * doit jamais être figée au moment du build.
 */
export const dynamic = "force-dynamic";


export default async function AccountsPage() {
  const snapshot = await getSnapshot();

  return (
    <>
      <SiteHeader active="/comptes" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">Comptes</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Regroupez vos lignes par enveloppe : PEA, compte-titres, crypto, livret.
            </p>
          </div>
          <AccountDialog
            trigger={
              <Button>
                <Plus className="size-4" aria-hidden />
                Nouveau compte
              </Button>
            }
          />
        </div>

        {snapshot.accounts.length === 0 ? (
          <EmptyState
            icon={<Wallet className="size-6" aria-hidden />}
            title="Aucun compte"
            description="Commencez par créer une enveloppe. Vous pourrez ensuite y ajouter vos lignes."
            action={
              <AccountDialog
                trigger={
                  <Button>
                    <Plus className="size-4" aria-hidden />
                    Créer un compte
                  </Button>
                }
              />
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {snapshot.accounts.map((a) => (
              <li key={a.id}>
                {/* Sous `sm`, le bloc chiffré passe à la ligne plutôt que
                    d'être rogné : quatre colonnes ne tiennent pas sur 390 px. */}
                <Link
                  href={`/comptes/${a.id}`}
                  className="group flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-hairline bg-surface p-4 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none sm:flex-nowrap sm:p-5"
                >
                  <span
                    className="size-9 shrink-0 rounded-xl"
                    style={{ backgroundColor: a.color }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{a.name}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-faint">
                      {ACCOUNT_KIND_LABELS[
                        a.kind as keyof typeof ACCOUNT_KIND_LABELS
                      ] ?? a.kind}
                      {a.institution ? ` · ${a.institution}` : ""}
                      {` · ${a.holdings.length} ligne${a.holdings.length > 1 ? "s" : ""}`}
                    </p>
                  </div>

                  <div className="flex w-full items-center justify-between gap-3 border-t border-hairline pt-3 sm:w-auto sm:border-0 sm:pt-0">
                    <div className="shrink-0 sm:text-right">
                      <p className="tnum text-sm font-medium text-ink">
                        {formatCurrency(a.value)}
                      </p>
                      <p className="tnum mt-0.5 text-xs text-ink-faint">
                        {formatPercent(a.weight)} du total
                      </p>
                    </div>
                    <DeltaBadge value={a.unrealizedPL} pct={a.unrealizedPLPct} />
                  </div>

                  <ChevronRight
                    className="hidden size-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 sm:block"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
