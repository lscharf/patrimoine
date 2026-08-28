import { notFound } from "next/navigation";
import { LoanView } from "@/components/loans/loan-view";
import { SiteHeader } from "@/components/site-header";
import { getAccounts, getLoanDetail } from "@/server/queries";

export const dynamic = "force-dynamic";

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const loanId = Number(id);
  if (!Number.isInteger(loanId)) notFound();

  const [loan, accounts] = await Promise.all([
    getLoanDetail(loanId),
    getAccounts(),
  ]);

  if (!loan) notFound();

  const simpleAccounts = accounts.map((a) => ({ id: a.id, name: a.name }));

  return (
    <>
      <SiteHeader active="/emprunts" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <LoanView loan={loan} accounts={simpleAccounts} />
      </main>
    </>
  );
}
