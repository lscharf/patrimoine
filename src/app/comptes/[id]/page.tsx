import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { AccountDialog, DeleteConfirm, HoldingDialog } from "@/components/forms";
import { HoldingsTable } from "@/components/holdings-table";
import { PortfolioSummary } from "@/components/portfolio-summary";
import { SiteHeader } from "@/components/site-header";
import { parseRange } from "@/lib/range";
import { Button } from "@/components/ui";
import { ACCOUNT_KIND_LABELS } from "@/server/actions/schemas";
import { deleteAccount } from "@/server/actions";
import { getAccountDetail, getHistory } from "@/server/queries";

export default async function AccountPage({
  params,
  searchParams,
}: PageProps<"/comptes/[id]">) {
  const { id } = await params;
  const accountId = Number(id);
  if (!Number.isInteger(accountId)) notFound();

  const account = await getAccountDetail(accountId);
  if (!account) notFound();

  const range = parseRange((await searchParams).p);
  const history = await getHistory(range, { accountId });

  return (
    <>
      <SiteHeader active="/comptes" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/comptes"
            className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Comptes
          </Link>

          <div className="flex items-center gap-2">
            <HoldingDialog
              accountId={account.id}
              accountName={account.name}
              trigger={
                <Button size="sm">
                  <Plus className="size-4" aria-hidden />
                  Ajouter une ligne
                </Button>
              }
            />
            <AccountDialog
              initial={{
                id: account.id,
                name: account.name,
                kind: account.kind,
                institution: account.institution ?? "",
                color: account.color,
              }}
              trigger={
                <Button size="sm" variant="secondary">
                  Modifier
                </Button>
              }
            />
            <DeleteConfirm
              title={`Supprimer « ${account.name} » ?`}
              description="Toutes les lignes de ce compte et l'intégralité de leur historique de transactions seront définitivement supprimées."
              confirmLabel="Supprimer le compte"
              onConfirm={async () => {
                "use server";
                return deleteAccount(account.id);
              }}
              redirectTo="/comptes"
              trigger={
                <Button size="icon" variant="ghost" aria-label="Supprimer le compte">
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              }
            />
          </div>
        </div>

        <PortfolioSummary
          title={`${account.name} · ${
            ACCOUNT_KIND_LABELS[account.kind as keyof typeof ACCOUNT_KIND_LABELS] ??
            account.kind
          }`}
          total={account.value}
          history={history}
          range={range}
        />

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-ink">
            Lignes
            <span className="tnum ml-2 text-ink-faint">{account.holdings.length}</span>
          </h2>
          <HoldingsTable
            holdings={account.holdings}
            total={account.value}
            showAccount={false}
            emptyLabel="Ce compte ne contient encore aucune ligne."
          />
        </section>
      </main>
    </>
  );
}
