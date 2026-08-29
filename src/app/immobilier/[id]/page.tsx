import { notFound } from "next/navigation";
import { PropertyView } from "@/components/real-estate/property-view";
import { SiteHeader } from "@/components/site-header";
import { getLiabilities, getPropertyDetail } from "@/server/queries";
import { getSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const propertyId = Number(id);
  if (!Number.isInteger(propertyId)) notFound();

  const [property, liabilities, session] = await Promise.all([
    getPropertyDetail(propertyId),
    getLiabilities(),
    getSession(),
  ]);

  if (!property) notFound();

  return (
    <>
      <SiteHeader active="/immobilier" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <PropertyView
          property={property}
          availableLoans={liabilities.loans}
          userName={session?.user?.name ?? "Léo Scharf"}
          userEmail={session?.user?.email}
        />
      </main>
    </>
  );
}
