import { Building2, Plus } from "lucide-react";
import { PropertyDialog } from "@/components/forms";
import { Montant } from "@/components/privacy/amount";
import { PropertyCard } from "@/components/real-estate/property-card";
import { SiteHeader } from "@/components/site-header";
import { Button, EmptyState } from "@/components/ui";
import { formatCurrency, formatPercent } from "@/lib/format";
import { getRealEstate } from "@/server/queries";

export const dynamic = "force-dynamic";

export default async function RealEstatePage() {
  const realEstate = await getRealEstate();
  return (
    <>
      <SiteHeader active="/immobilier" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* En-tête de la page */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Patrimoine Immobilier
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Suivi de vos résidences principales, secondaires et investissements locatifs.
            </p>
          </div>

          <PropertyDialog
            trigger={
              <Button className="shrink-0 gap-1.5 self-start sm:self-auto">
                <Plus className="size-4" aria-hidden />
                <span>Nouveau bien</span>
              </Button>
            }
          />
        </div>

        {realEstate.properties.length === 0 ? (
          <EmptyState
            icon={<Building2 className="size-6" aria-hidden />}
            title="Aucun bien immobilier enregistré"
            description="Ajoutez votre résidence principale, vos appartements locatifs ou vos terrains pour intégrer leur valorisation et déduire vos crédits associés."
            action={
              <PropertyDialog
                trigger={
                  <Button className="gap-1.5">
                    <Plus className="size-4" aria-hidden />
                    <span>Ajouter mon premier bien</span>
                  </Button>
                }
              />
            }
          />
        ) : (
          <>
            {/* Carte de synthèse globale du patrimoine immobilier */}
            <section className="rounded-card border border-hairline bg-surface p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                    Patrimoine net immobilier (Fonds propres)
                  </p>
                  <p className="tnum mt-2 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
                    <Montant>{formatCurrency(realEstate.totalNetEquity)}</Montant>
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
                    <span className="flex items-center gap-1.5 text-ink">
                      <span>Valeur brute :</span>
                      <span className="font-semibold">
                        <Montant>{formatCurrency(realEstate.totalGrossValue)}</Montant>
                      </span>
                    </span>
                    <span>·</span>
                    <span>
                      Dettes liées :{" "}
                      <span className="text-accent font-medium">
                        <Montant>{formatCurrency(realEstate.totalRemainingDebt)}</Montant>
                      </span>
                    </span>
                    <span>·</span>
                    <span>
                      {realEstate.propertiesCount} bien{realEstate.propertiesCount > 1 ? "s" : ""}
                    </span>
                    {realEstate.totalSurface > 0 && (
                      <>
                        <span>·</span>
                        <span>{realEstate.totalSurface} m²</span>
                      </>
                    )}
                    {realEstate.totalUnrealizedGain !== 0 && (
                      <>
                        <span>·</span>
                        <span>
                          Plus-value :{" "}
                          <span
                            className={
                              realEstate.totalUnrealizedGain >= 0
                                ? "text-positive font-medium"
                                : "text-negative font-medium"
                            }
                          >
                            {realEstate.totalUnrealizedGain >= 0 ? "+" : ""}
                            <Montant>
                              {formatCurrency(realEstate.totalUnrealizedGain)}
                            </Montant>
                            {realEstate.totalUnrealizedGainPct != null &&
                              ` (${formatPercent(realEstate.totalUnrealizedGainPct / 100)})`}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Grille des biens */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink">
                  Vos biens immobiliers ({realEstate.properties.length})
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {realEstate.properties.map((prop) => (
                  <PropertyCard key={prop.id} property={prop} />
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
