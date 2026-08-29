import Link from "next/link";
import {
  Building2,
  ChevronRight,
  CreditCard,
  Home,
  MapPin,
  TrendingUp,
} from "lucide-react";
import { Montant } from "@/components/privacy/amount";
import { Badge, Card } from "@/components/ui";
import { formatCurrency, formatPercent } from "@/lib/format";
import { PROPERTY_CATEGORY_LABELS } from "@/server/actions/schemas";
import type { PropertySummary } from "@/server/real-estate/types";

export function PropertyCard({ property }: { property: PropertySummary }) {
  const isPositiveGain = property.unrealizedGain >= 0;

  return (
    <Link
      href={`/immobilier/${property.id}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Card className="flex h-full flex-col justify-between p-5 transition-all hover:border-accent/40 hover:bg-surface-elevated/40">
        <div className="space-y-3">
          {/* Ligne 1 : Icône + Nom + Badge de catégorie */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent group-hover:bg-accent group-hover:text-canvas transition-colors">
                {property.type === "MAISON" ? (
                  <Home className="size-5" aria-hidden />
                ) : (
                  <Building2 className="size-5" aria-hidden />
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-ink group-hover:text-accent transition-colors line-clamp-1">
                  {property.name}
                </h3>
                <p className="flex items-center gap-1 text-xs text-ink-muted">
                  <MapPin className="size-3 text-ink-faint" aria-hidden />
                  <span className="line-clamp-1">
                    {property.city
                      ? `${property.city} (${property.zipcode || ""})`
                      : property.address || "Adresse non renseignée"}
                  </span>
                </p>
              </div>
            </div>

            <Badge variant="neutral" className="text-[11px] shrink-0">
              {PROPERTY_CATEGORY_LABELS[property.category] ?? property.category}
            </Badge>
          </div>

          {/* Ligne 2 : Montant principal (Valeur estimée) & Plus-value */}
          <div className="pt-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
              Valeur estimée
            </p>
            <div className="flex items-baseline justify-between gap-2">
              <p className="tnum text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                <Montant>{formatCurrency(property.estimatedValue)}</Montant>
              </p>

              {property.unrealizedGain !== 0 && (
                <div
                  className={`flex items-center gap-1 text-xs font-semibold ${
                    isPositiveGain ? "text-positive" : "text-negative"
                  }`}
                >
                  <TrendingUp className="size-3.5" aria-hidden />
                  <span>
                    {isPositiveGain ? "+" : ""}
                    <Montant>{formatCurrency(property.unrealizedGain)}</Montant>
                  </span>
                  {property.unrealizedGainPct != null && (
                    <span>({formatPercent(property.unrealizedGainPct / 100)})</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ligne 3 : Métriques de bas de carte (Surface, Prix/m2, Dette, Equity) */}
        <div className="mt-5 border-t border-hairline pt-3">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-[10px] text-ink-faint">Surface & Prix/m²</p>
              <p className="tnum font-medium text-ink">
                {property.surface} m²
                {property.pricePerSquareMeter && (
                  <span className="ml-1 text-[10px] text-ink-muted">
                    ({formatCurrency(property.pricePerSquareMeter)}/m²)
                  </span>
                )}
              </p>
            </div>

            <div>
              <p className="text-[10px] text-ink-faint">Dette liée</p>
              <p className="tnum font-medium text-ink">
                {property.totalRemainingDebt > 0 ? (
                  <span className="text-accent flex items-center gap-1">
                    <CreditCard className="size-3" aria-hidden />
                    <Montant>{formatCurrency(property.totalRemainingDebt)}</Montant>
                  </span>
                ) : (
                  <span className="text-ink-muted">Aucune</span>
                )}
              </p>
            </div>

            <div>
              <p className="text-[10px] text-ink-faint">Patrimoine net</p>
              <p className="tnum font-semibold text-positive">
                <Montant>{formatCurrency(property.netEquity)}</Montant>
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-ink-faint group-hover:text-ink transition-colors">
            <span>
              {property.rooms} pièce{property.rooms > 1 ? "s" : ""}
              {property.floor != null ? ` · Étage ${property.floor}` : ""}
              {property.garages > 0 ? ` · ${property.garages} garage` : ""}
            </span>
            <div className="flex items-center gap-0.5 text-accent font-medium">
              <span>Détails & Analyse</span>
              <ChevronRight className="size-3.5" aria-hidden />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
