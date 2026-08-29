"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Check,
  CreditCard,
  Home,
  Minus,
  Plus,
  TrendingUp,
} from "lucide-react";
import { DeleteConfirm } from "@/components/forms/delete-confirm";
import { Montant } from "@/components/privacy/amount";
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  deleteProperty,
  linkLoansToProperty,
  updateProperty,
} from "@/server/actions";
import {
  PROPERTY_CATEGORIES,
  PROPERTY_CATEGORY_LABELS,
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPES,
  ROOM_CONDITION_LABELS,
  ROOM_CONDITIONS,
  ROOM_QUALITIES,
  ROOM_QUALITY_LABELS,
} from "@/server/actions/schemas";
import type {
  PropertyCategory,
  PropertySummary,
  PropertyType,
} from "@/server/real-estate/types";
import type { LoanSummary } from "@/server/loans/types";

interface PropertyViewProps {
  property: PropertySummary;
  availableLoans?: LoanSummary[];
  userName?: string;
  userEmail?: string;
}
export function PropertyView({
  property,
  availableLoans = [],
  userName = "Léo Scharf",
  userEmail,
}: PropertyViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<
    "apercu" | "analyse" | "parametres"
  >("apercu");

  const [paramSection, setParamSection] = React.useState<
    | "description"
    | "caracteristiques"
    | "details"
    | "pieces"
    | "emprunts"
    | "detention"
  >("description");

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [linkLoansOpen, setLinkLoansOpen] = React.useState(false);
  const [selectedLoanIds, setSelectedLoanIds] = React.useState<number[]>(
    property.linkedLoans.map((l) => l.id),
  );
  const [isSaving, setIsSaving] = React.useState(false);

  // État local du formulaire Paramètres - Description
  const [name, setName] = React.useState(property.name);
  const [description, setDescription] = React.useState(property.description ?? "");
  const [type, setType] = React.useState<PropertyType>(property.type);
  const [category, setCategory] = React.useState<PropertyCategory>(
    property.category,
  );
  const [address, setAddress] = React.useState(property.address ?? "");
  const [city, setCity] = React.useState(property.city ?? "");
  const [zipcode, setZipcode] = React.useState(property.zipcode ?? "");

  // Caractéristiques
  const [surface, setSurface] = React.useState(String(property.surface));
  const [purchasePrice, setPurchasePrice] = React.useState(
    String(property.purchasePrice),
  );
  const [purchaseDate, setPurchaseDate] = React.useState(
    property.purchaseDate ?? "",
  );
  const [notaryFees, setNotaryFees] = React.useState(
    property.notaryFees ? String(property.notaryFees) : "",
  );
  const [renovationCosts, setRenovationCosts] = React.useState(
    property.renovationCosts ? String(property.renovationCosts) : "",
  );
  const [estimatedValue, setEstimatedValue] = React.useState(
    String(property.estimatedValue),
  );
  const [monthlyRent, setMonthlyRent] = React.useState(
    property.monthlyRent ? String(property.monthlyRent) : "",
  );
  const [condoFees, setCondoFees] = React.useState(
    property.condoFees ? String(property.condoFees) : "",
  );
  const [propertyTax, setPropertyTax] = React.useState(
    property.propertyTax ? String(property.propertyTax) : "",
  );

  // Détails (Screenshot 2)
  const [floor, setFloor] = React.useState(property.floor ?? 0);
  const [totalFloors, setTotalFloors] = React.useState(
    property.totalFloors ?? 0,
  );
  const [rooms, setRooms] = React.useState(property.rooms);
  const [bedrooms, setBedrooms] = React.useState(property.bedrooms);
  const [bathrooms, setBathrooms] = React.useState(property.bathrooms);
  const [garages, setGarages] = React.useState(property.garages);
  const [parkingSpots, setParkingSpots] = React.useState(property.parkingSpots);
  const [gardenSurface, setGardenSurface] = React.useState(
    property.gardenSurface ? String(property.gardenSurface) : "",
  );
  const [terraceSurface, setTerraceSurface] = React.useState(
    property.terraceSurface ? String(property.terraceSurface) : "",
  );
  const [hasElevator, setHasElevator] = React.useState(property.hasElevator);
  const [isNew, setIsNew] = React.useState(property.isNew);
  const [isFurnished, setIsFurnished] = React.useState(property.isFurnished);

  // Pièces (Screenshot 3)
  const [kitchenQuality, setKitchenQuality] = React.useState(
    property.kitchenQuality ?? "EXCEPTIONAL",
  );
  const [kitchenCondition, setKitchenCondition] = React.useState(
    property.kitchenCondition ?? "NEW",
  );
  const [bathroomQuality, setBathroomQuality] = React.useState(
    property.bathroomQuality ?? "HIGH_END",
  );
  const [bathroomCondition, setBathroomCondition] = React.useState(
    property.bathroomCondition ?? "WELL_MAINTAINED",
  );
  const [flooringQuality, setFlooringQuality] = React.useState(
    property.flooringQuality ?? "HIGH_END",
  );
  const [flooringCondition, setFlooringCondition] = React.useState(
    property.flooringCondition ?? "WELL_MAINTAINED",
  );
  const [windowsQuality, setWindowsQuality] = React.useState(
    property.windowsQuality ?? "HIGH_END",
  );
  const [windowsCondition, setWindowsCondition] = React.useState(
    property.windowsCondition ?? "WELL_MAINTAINED",
  );
  const [generalQuality, setGeneralQuality] = React.useState(
    property.generalQuality ?? "HIGH_END",
  );
  const [generalCondition, setGeneralCondition] = React.useState(
    property.generalCondition ?? "WELL_MAINTAINED",
  );

  // Détention (Screenshot 5)
  const [ownershipPct, setOwnershipPct] = React.useState(
    property.ownershipPct ?? 100,
  );

  const handleSaveParams = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);

    const payload = {
      name,
      description: description || undefined,
      type,
      category,
      address: address || undefined,
      city: city || undefined,
      zipcode: zipcode || undefined,
      surface: surface.replace(",", "."),
      purchasePrice: purchasePrice.replace(",", "."),
      purchaseDate: purchaseDate || undefined,
      notaryFees: notaryFees ? notaryFees.replace(",", ".") : "0",
      renovationCosts: renovationCosts ? renovationCosts.replace(",", ".") : "0",
      estimatedValue: estimatedValue.replace(",", "."),
      monthlyRent: monthlyRent ? monthlyRent.replace(",", ".") : "0",
      condoFees: condoFees ? condoFees.replace(",", ".") : "0",
      propertyTax: propertyTax ? propertyTax.replace(",", ".") : "0",
      floor: floor || undefined,
      totalFloors: totalFloors || undefined,
      rooms: Number(rooms) || 1,
      bedrooms: Number(bedrooms) || 1,
      bathrooms: Number(bathrooms) || 1,
      garages: Number(garages) || 0,
      parkingSpots: Number(parkingSpots) || 0,
      gardenSurface: gardenSurface ? gardenSurface.replace(",", ".") : "0",
      terraceSurface: terraceSurface ? terraceSurface.replace(",", ".") : "0",
      hasElevator,
      isNew,
      isFurnished,
      kitchenQuality: kitchenQuality || undefined,
      kitchenCondition: kitchenCondition || undefined,
      bathroomQuality: bathroomQuality || undefined,
      bathroomCondition: bathroomCondition || undefined,
      flooringQuality: flooringQuality || undefined,
      flooringCondition: flooringCondition || undefined,
      windowsQuality: windowsQuality || undefined,
      windowsCondition: windowsCondition || undefined,
      generalQuality: generalQuality || undefined,
      generalCondition: generalCondition || undefined,
      ownershipPct: Number(ownershipPct) || 100,
    };

    const res = await updateProperty(property.id, payload);
    setIsSaving(false);
    if (res.ok) {
      toast.success("Paramètres enregistrés avec succès");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  const handleSaveLoanLinks = async () => {
    setIsSaving(true);
    const res = await linkLoansToProperty(property.id, selectedLoanIds);
    setIsSaving(false);
    setLinkLoansOpen(false);

    if (res.ok) {
      toast.success("Emprunts rattachés mis à jour");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  const userInitials = (userName || "LS")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      {/* En-tête : retour + Titre + Onglets de navigation Finary */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/immobilier"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-hairline bg-surface text-ink-muted transition-colors hover:bg-surface-elevated hover:text-ink"
            aria-label="Retour à l'immobilier"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>

          <div className="flex items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              {property.type === "MAISON" ? (
                <Home className="size-4" aria-hidden />
              ) : (
                <Building2 className="size-4" aria-hidden />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-ink sm:text-xl">
                  {property.name}
                </h1>
                <Badge variant="neutral" className="text-[11px]">
                  {PROPERTY_CATEGORY_LABELS[property.category] ?? property.category}
                </Badge>
              </div>
              <p className="text-xs text-ink-muted">
                {PROPERTY_TYPE_LABELS[property.type]} · {property.surface} m²
                {property.city ? ` · ${property.city}` : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Onglets Aperçu / Analyse / Paramètres */}
        <div className="flex items-center gap-1 rounded-lg border border-hairline bg-surface p-1">
          <button
            type="button"
            onClick={() => setActiveTab("apercu")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "apercu"
                ? "bg-accent/15 text-accent"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            Aperçu
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("analyse")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "analyse"
                ? "bg-accent/15 text-accent"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            Analyse
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("parametres")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "parametres"
                ? "bg-accent/15 text-accent"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            Paramètres
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ONGLET 1 : APERÇU                                                         */}
      {/* ========================================================================= */}
      {activeTab === "apercu" && (
        <div className="space-y-6">
          <section className="rounded-card border border-hairline bg-surface p-5 sm:p-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                Valeur estimée du bien
              </p>
              <div className="flex flex-wrap items-baseline gap-3">
                <p className="tnum mt-2 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
                  <Montant>{formatCurrency(property.estimatedValue)}</Montant>
                </p>

                {property.unrealizedGain !== 0 && (
                  <div
                    className={`flex items-center gap-1.5 text-sm font-semibold ${
                      property.unrealizedGain >= 0
                        ? "text-positive"
                        : "text-negative"
                    }`}
                  >
                    <TrendingUp className="size-4" aria-hidden />
                    <span>
                      {property.unrealizedGain >= 0 ? "+" : ""}
                      <Montant>{formatCurrency(property.unrealizedGain)}</Montant>
                    </span>
                    {property.unrealizedGainPct != null && (
                      <span>
                        ({formatPercent(property.unrealizedGainPct / 100)})
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                <span>Patrimoine net sur le bien :</span>
                <span className="font-semibold text-positive">
                  <Montant>{formatCurrency(property.netEquity)}</Montant>
                </span>
                {property.totalRemainingDebt > 0 && (
                  <>
                    <span>·</span>
                    <span>
                      Dette restante :{" "}
                      <span className="font-medium text-accent">
                        <Montant>{formatCurrency(property.totalRemainingDebt)}</Montant>
                      </span>
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* 4 Cartes de métriques clés */}
            <div className="mt-8 grid grid-cols-2 gap-3 border-t border-hairline pt-6 sm:grid-cols-4">
              <div className="rounded-lg bg-surface-muted/40 p-3">
                <p className="text-[11px] font-medium text-ink-faint">
                  Prix d&apos;acquisition total
                </p>
                <p className="tnum mt-1 text-base font-semibold text-ink">
                  <Montant>{formatCurrency(property.totalAcquisitionCost)}</Montant>
                </p>
                <p className="mt-0.5 text-[10px] text-ink-faint">
                  Achat + Notaire + Travaux
                </p>
              </div>

              <div className="rounded-lg bg-surface-muted/40 p-3">
                <p className="text-[11px] font-medium text-ink-faint">
                  Surface & Prix / m²
                </p>
                <p className="tnum mt-1 text-base font-semibold text-ink">
                  {property.surface} m²
                </p>
                <p className="mt-0.5 text-[10px] text-ink-muted">
                  {property.pricePerSquareMeter
                    ? `${formatCurrency(property.pricePerSquareMeter)} / m²`
                    : "—"}
                </p>
              </div>

              <div className="rounded-lg bg-surface-muted/40 p-3">
                <p className="text-[11px] font-medium text-ink-faint">
                  Crédit(s) rattaché(s)
                </p>
                <p className="tnum mt-1 text-base font-semibold text-ink">
                  {property.linkedLoans.length > 0 ? (
                    <span className="text-accent">
                      {property.linkedLoans.length} emprunt
                      {property.linkedLoans.length > 1 ? "s" : ""}
                    </span>
                  ) : (
                    "Aucun crédit"
                  )}
                </p>
                <p className="mt-0.5 text-[10px] text-ink-faint">
                  {property.totalRemainingDebt > 0 ? (
                    <Montant>{formatCurrency(property.totalRemainingDebt)}</Montant>
                  ) : (
                    "Financement 100% fonds propres"
                  )}
                </p>
              </div>

              <div className="rounded-lg bg-surface-muted/40 p-3">
                <p className="text-[11px] font-medium text-ink-faint">
                  {property.category === "LOCATIF"
                    ? "Rendement brut"
                    : "Quote-part de détention"}
                </p>
                <p className="tnum mt-1 text-base font-semibold text-ink">
                  {property.category === "LOCATIF"
                    ? property.grossYieldPct
                      ? `${property.grossYieldPct.toFixed(2)}%`
                      : "—"
                    : `${property.ownershipPct}%`}
                </p>
                <p className="mt-0.5 text-[10px] text-ink-faint">
                  {property.category === "LOCATIF"
                    ? `${formatCurrency(property.monthlyRent)}/mois`
                    : "Pleine propriété"}
                </p>
              </div>
            </div>
          </section>

          {/* Section Caractéristiques & Équipements */}
          <section className="rounded-card border border-hairline bg-surface p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-semibold text-ink">
              Caractéristiques & Prestations du bien
            </h2>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-hairline p-3 text-xs">
                <span className="text-ink-faint">Disposition</span>
                <p className="mt-1 font-medium text-ink">
                  {property.rooms} pièces · {property.bedrooms} chambres ·{" "}
                  {property.bathrooms} SDB
                </p>
              </div>

              <div className="rounded-lg border border-hairline p-3 text-xs">
                <span className="text-ink-faint">Étage & Immeuble</span>
                <p className="mt-1 font-medium text-ink">
                  {property.floor != null ? `Étage ${property.floor}` : "RDC"}
                  {property.totalFloors ? ` sur ${property.totalFloors}` : ""}
                  {property.hasElevator ? " · Avec ascenseur" : ""}
                </p>
              </div>

              <div className="rounded-lg border border-hairline p-3 text-xs">
                <span className="text-ink-faint">Extérieur & Stationnement</span>
                <p className="mt-1 font-medium text-ink">
                  {property.terraceSurface > 0
                    ? `Terrasse ${property.terraceSurface} m²`
                    : property.gardenSurface > 0
                      ? `Jardin ${property.gardenSurface} m²`
                      : "Pas d'extérieur"}
                  {property.garages > 0 ? ` · ${property.garages} garage` : ""}
                  {property.parkingSpots > 0
                    ? ` · ${property.parkingSpots} parking`
                    : ""}
                </p>
              </div>
            </div>

            {/* Prestations intérieures (Pièces) */}
            <div className="mt-4 border-t border-hairline pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-3">
                État des pièces & Matériaux
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-xs">
                <div className="rounded-md bg-surface-muted/30 p-2.5">
                  <p className="font-medium text-ink">Cuisine</p>
                  <p className="text-[11px] text-ink-muted">
                    {ROOM_QUALITY_LABELS[property.kitchenQuality as keyof typeof ROOM_QUALITY_LABELS] || "Standard"}
                  </p>
                  <p className="text-[10px] text-ink-faint">
                    {ROOM_CONDITION_LABELS[property.kitchenCondition as keyof typeof ROOM_CONDITION_LABELS] || "Bon état"}
                  </p>
                </div>

                <div className="rounded-md bg-surface-muted/30 p-2.5">
                  <p className="font-medium text-ink">Salle de bain</p>
                  <p className="text-[11px] text-ink-muted">
                    {ROOM_QUALITY_LABELS[property.bathroomQuality as keyof typeof ROOM_QUALITY_LABELS] || "Standard"}
                  </p>
                  <p className="text-[10px] text-ink-faint">
                    {ROOM_CONDITION_LABELS[property.bathroomCondition as keyof typeof ROOM_CONDITION_LABELS] || "Bon état"}
                  </p>
                </div>

                <div className="rounded-md bg-surface-muted/30 p-2.5">
                  <p className="font-medium text-ink">Sol</p>
                  <p className="text-[11px] text-ink-muted">
                    {ROOM_QUALITY_LABELS[property.flooringQuality as keyof typeof ROOM_QUALITY_LABELS] || "Standard"}
                  </p>
                  <p className="text-[10px] text-ink-faint">
                    {ROOM_CONDITION_LABELS[property.flooringCondition as keyof typeof ROOM_CONDITION_LABELS] || "Bon état"}
                  </p>
                </div>

                <div className="rounded-md bg-surface-muted/30 p-2.5">
                  <p className="font-medium text-ink">Fenêtres</p>
                  <p className="text-[11px] text-ink-muted">
                    {ROOM_QUALITY_LABELS[property.windowsQuality as keyof typeof ROOM_QUALITY_LABELS] || "Standard"}
                  </p>
                  <p className="text-[10px] text-ink-faint">
                    {ROOM_CONDITION_LABELS[property.windowsCondition as keyof typeof ROOM_CONDITION_LABELS] || "Bon état"}
                  </p>
                </div>

                <div className="col-span-2 rounded-md bg-surface-muted/30 p-2.5 sm:col-span-1">
                  <p className="font-medium text-ink">Général</p>
                  <p className="text-[11px] text-ink-muted">
                    {ROOM_QUALITY_LABELS[property.generalQuality as keyof typeof ROOM_QUALITY_LABELS] || "Standard"}
                  </p>
                  <p className="text-[10px] text-ink-faint">
                    {ROOM_CONDITION_LABELS[property.generalCondition as keyof typeof ROOM_CONDITION_LABELS] || "Bon état"}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 2 : ANALYSE                                                        */}
      {/* ========================================================================= */}
      {activeTab === "analyse" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Carte 1 : Répartition financière */}
            <Card className="p-5 space-y-4">
              <h3 className="text-sm font-semibold text-ink">
                Structure financière du bien
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-muted">Valeur estimée actuelle</span>
                  <span className="font-bold text-ink">
                    <Montant>{formatCurrency(property.estimatedValue)}</Montant>
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-muted">Capital restant dû (dette)</span>
                  <span className="font-semibold text-accent">
                    <Montant>{formatCurrency(property.totalRemainingDebt)}</Montant>
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs border-t border-hairline pt-2">
                  <span className="text-ink font-medium">Patrimoine net (fonds propres)</span>
                  <span className="font-bold text-positive">
                    <Montant>{formatCurrency(property.netEquity)}</Montant>
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-muted">Plus-value latente</span>
                  <span
                    className={`font-semibold ${
                      property.unrealizedGain >= 0
                        ? "text-positive"
                        : "text-negative"
                    }`}
                  >
                    {property.unrealizedGain >= 0 ? "+" : ""}
                    <Montant>{formatCurrency(property.unrealizedGain)}</Montant>
                    {property.unrealizedGainPct != null &&
                      ` (${formatPercent(property.unrealizedGainPct / 100)})`}
                  </span>
                </div>
              </div>

              {/* Ratios */}
              <div className="mt-4 rounded-lg bg-surface-muted/30 p-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-ink-faint">Ratio Dette / Valeur (LTV)</span>
                  <span className="font-medium text-ink">
                    {property.loanToValuePct != null
                      ? `${property.loanToValuePct.toFixed(1)}%`
                      : "0%"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-faint">Prix d&apos;achat initial</span>
                  <span className="font-medium text-ink">
                    <Montant>{formatCurrency(property.purchasePrice)}</Montant>
                  </span>
                </div>
              </div>
            </Card>

            {/* Carte 2 : Emprunts liés */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">
                  Emprunts rattachés ({property.linkedLoans.length})
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLinkLoansOpen(true)}
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="size-3" />
                  <span>Gérer</span>
                </Button>
              </div>

              {property.linkedLoans.length === 0 ? (
                <div className="rounded-lg border border-dashed border-hairline p-6 text-center text-xs text-ink-muted">
                  Aucun emprunt n&apos;est rattaché à ce bien immobilier.
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLinkLoansOpen(true)}
                    >
                      Lier un emprunt existant
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {property.linkedLoans.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between rounded-lg border border-hairline bg-surface-muted/20 p-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-7 items-center justify-center rounded-full bg-accent/20 text-accent font-bold text-[10px]">
                          {userInitials}
                        </div>
                        <div>
                          <Link
                            href={`/emprunts/${l.id}`}
                            className="font-medium text-ink hover:text-accent hover:underline"
                          >
                            {l.name}
                          </Link>
                          <p className="text-[10px] text-ink-faint">
                            {formatCurrency(l.monthlyPayment)}/mois · Taux {l.interestRate}%
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-ink">
                          <Montant>{formatCurrency(l.remainingCapital)}</Montant>
                        </p>
                        <p className="text-[10px] text-ink-faint">restant dû</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 3 : PARAMÈTRES (Reproduisant exactement Finary)                     */}
      {/* ========================================================================= */}
      {activeTab === "parametres" && (
        <div className="grid gap-6 md:grid-cols-12">
          {/* Barre latérale gauche avec les 6 sections + Supprimer */}
          <div className="space-y-1 md:col-span-3">
            <button
              type="button"
              onClick={() => setParamSection("description")}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                paramSection === "description"
                  ? "bg-accent/15 text-accent font-semibold"
                  : "text-ink-muted hover:bg-surface-elevated/40 hover:text-ink"
              }`}
            >
              Description
            </button>

            <button
              type="button"
              onClick={() => setParamSection("caracteristiques")}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                paramSection === "caracteristiques"
                  ? "bg-accent/15 text-accent font-semibold"
                  : "text-ink-muted hover:bg-surface-elevated/40 hover:text-ink"
              }`}
            >
              Caractéristiques
            </button>

            <button
              type="button"
              onClick={() => setParamSection("details")}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                paramSection === "details"
                  ? "bg-accent/15 text-accent font-semibold"
                  : "text-ink-muted hover:bg-surface-elevated/40 hover:text-ink"
              }`}
            >
              Détails
            </button>

            <button
              type="button"
              onClick={() => setParamSection("pieces")}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                paramSection === "pieces"
                  ? "bg-accent/15 text-accent font-semibold"
                  : "text-ink-muted hover:bg-surface-elevated/40 hover:text-ink"
              }`}
            >
              Pièces
            </button>

            <button
              type="button"
              onClick={() => setParamSection("emprunts")}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                paramSection === "emprunts"
                  ? "bg-accent/15 text-accent font-semibold"
                  : "text-ink-muted hover:bg-surface-elevated/40 hover:text-ink"
              }`}
            >
              Emprunts liés
            </button>

            <button
              type="button"
              onClick={() => setParamSection("detention")}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                paramSection === "detention"
                  ? "bg-accent/15 text-accent font-semibold"
                  : "text-ink-muted hover:bg-surface-elevated/40 hover:text-ink"
              }`}
            >
              Détention
            </button>

            <div className="pt-4 border-t border-hairline mt-4">
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-negative transition-colors hover:bg-negative/10"
              >
                Supprimer
              </button>
            </div>
          </div>

          {/* Contenu principal de la section Paramètres */}
          <div className="md:col-span-9">
            <Card className="p-6">
              {/* ------------------------------------------------------------- */}
              {/* SECTION 1 : DESCRIPTION (Screenshot 1)                        */}
              {/* ------------------------------------------------------------- */}
              {paramSection === "description" && (
                <form onSubmit={handleSaveParams} className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="param-name">Nom</Label>
                      <Input
                        id="param-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="param-desc">Description</Label>
                      <Input
                        id="param-desc"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Description du bien..."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="param-type">Type</Label>
                      <Select
                        value={type}
                        onValueChange={(val) => setType(val as PropertyType)}
                      >
                        <SelectTrigger id="param-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROPERTY_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {PROPERTY_TYPE_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="param-category">Catégorie</Label>
                      <Select
                        value={category}
                        onValueChange={(val) =>
                          setCategory(val as PropertyCategory)
                        }
                      >
                        <SelectTrigger id="param-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROPERTY_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {PROPERTY_CATEGORY_LABELS[c]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="param-address">Adresse</Label>
                      <Input
                        id="param-address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="1 Rue de la Robertsau, 67300 Schiltigheim, France"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="param-city">Ville</Label>
                      <Input
                        id="param-city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Schiltigheim"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="param-zipcode">Code postal</Label>
                      <Input
                        id="param-zipcode"
                        value={zipcode}
                        onChange={(e) => setZipcode(e.target.value)}
                        placeholder="67300"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-hairline">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? "Enregistrement..." : "Enregistrer les modifications"}
                    </Button>
                  </div>
                </form>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SECTION 2 : CARACTÉRISTIQUES                                  */}
              {/* ------------------------------------------------------------- */}
              {paramSection === "caracteristiques" && (
                <form onSubmit={handleSaveParams} className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="param-surface">Surface habitable (m²)</Label>
                      <Input
                        id="param-surface"
                        type="text"
                        inputMode="decimal"
                        value={surface}
                        onChange={(e) => setSurface(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="param-est-val">Valeur estimée (€)</Label>
                      <Input
                        id="param-est-val"
                        type="text"
                        inputMode="decimal"
                        value={estimatedValue}
                        onChange={(e) => setEstimatedValue(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="param-buy-price">Prix d&apos;achat (€)</Label>
                      <Input
                        id="param-buy-price"
                        type="text"
                        inputMode="decimal"
                        value={purchasePrice}
                        onChange={(e) => setPurchasePrice(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="param-buy-date">Date d&apos;achat</Label>
                      <Input
                        id="param-buy-date"
                        type="date"
                        value={purchaseDate}
                        onChange={(e) => setPurchaseDate(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="param-notary">Frais de notaire (€)</Label>
                      <Input
                        id="param-notary"
                        type="text"
                        inputMode="decimal"
                        value={notaryFees}
                        onChange={(e) => setNotaryFees(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="param-reno">Travaux réalisés (€)</Label>
                      <Input
                        id="param-reno"
                        type="text"
                        inputMode="decimal"
                        value={renovationCosts}
                        onChange={(e) => setRenovationCosts(e.target.value)}
                      />
                    </div>

                    {category === "LOCATIF" && (
                      <>
                        <div className="space-y-1.5">
                          <Label htmlFor="param-rent">Loyer mensuel brut (€)</Label>
                          <Input
                            id="param-rent"
                            type="text"
                            inputMode="decimal"
                            value={monthlyRent}
                            onChange={(e) => setMonthlyRent(e.target.value)}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="param-condo">Charges de copropriété (€/mois)</Label>
                          <Input
                            id="param-condo"
                            type="text"
                            inputMode="decimal"
                            value={condoFees}
                            onChange={(e) => setCondoFees(e.target.value)}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="param-tax">Taxe foncière (€/an)</Label>
                          <Input
                            id="param-tax"
                            type="text"
                            inputMode="decimal"
                            value={propertyTax}
                            onChange={(e) => setPropertyTax(e.target.value)}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex justify-end pt-4 border-t border-hairline">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? "Enregistrement..." : "Enregistrer les modifications"}
                    </Button>
                  </div>
                </form>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SECTION 3 : DÉTAILS (Screenshot 2)                            */}
              {/* ------------------------------------------------------------- */}
              {paramSection === "details" && (
                <form onSubmit={handleSaveParams} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    {/* Étage */}
                    <div className="flex items-center justify-between rounded-lg border border-hairline p-3">
                      <span className="text-sm text-ink">
                        {floor > 0 ? `${floor}ème étage` : "Rez-de-chaussée"}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() => setFloor(Math.max(0, floor - 1))}
                        >
                          <Minus className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() => setFloor(floor + 1)}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Étages dans le bâtiment */}
                    <div className="flex items-center justify-between rounded-lg border border-hairline p-3">
                      <span className="text-sm text-ink">
                        {totalFloors} étage{totalFloors > 1 ? "s" : ""} dans le bâtiment
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() =>
                            setTotalFloors(Math.max(0, totalFloors - 1))
                          }
                        >
                          <Minus className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() => setTotalFloors(totalFloors + 1)}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Pièces */}
                    <div className="flex items-center justify-between rounded-lg border border-hairline p-3">
                      <span className="text-sm text-ink">
                        {rooms} pièce{rooms > 1 ? "s" : ""}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() => setRooms(Math.max(1, rooms - 1))}
                        >
                          <Minus className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() => setRooms(rooms + 1)}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Chambres */}
                    <div className="flex items-center justify-between rounded-lg border border-hairline p-3">
                      <span className="text-sm text-ink">
                        {bedrooms} chambre{bedrooms > 1 ? "s" : ""}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() => setBedrooms(Math.max(0, bedrooms - 1))}
                        >
                          <Minus className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() => setBedrooms(bedrooms + 1)}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Salles de bain */}
                    <div className="flex items-center justify-between rounded-lg border border-hairline p-3">
                      <span className="text-sm text-ink">
                        {bathrooms} salle{bathrooms > 1 ? "s" : ""} de bain
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() =>
                            setBathrooms(Math.max(0, bathrooms - 1))
                          }
                        >
                          <Minus className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() => setBathrooms(bathrooms + 1)}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Garage */}
                    <div className="flex items-center justify-between rounded-lg border border-hairline p-3">
                      <span className="text-sm text-ink">
                        {garages} garage{garages > 1 ? "s" : ""}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() => setGarages(Math.max(0, garages - 1))}
                        >
                          <Minus className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() => setGarages(garages + 1)}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Parking */}
                    <div className="flex items-center justify-between rounded-lg border border-hairline p-3">
                      <span className="text-sm text-ink">
                        {parkingSpots} place{parkingSpots > 1 ? "s" : ""} de parking
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() =>
                            setParkingSpots(Math.max(0, parkingSpots - 1))
                          }
                        >
                          <Minus className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() => setParkingSpots(parkingSpots + 1)}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Jardin & Terrasse */}
                    <div className="space-y-1.5">
                      <Label htmlFor="param-jardin">Jardin (m²)</Label>
                      <Input
                        id="param-jardin"
                        type="text"
                        inputMode="decimal"
                        placeholder="Ex : 0"
                        value={gardenSurface}
                        onChange={(e) => setGardenSurface(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="param-terrasse">Balcon / Terrasse (m²)</Label>
                      <Input
                        id="param-terrasse"
                        type="text"
                        inputMode="decimal"
                        placeholder="Ex : 9"
                        value={terraceSurface}
                        onChange={(e) => setTerraceSurface(e.target.value)}
                      />
                    </div>

                    {/* Toggles : Ascenseur, Neuf, Meublé */}
                    <div className="flex items-center justify-between rounded-lg border border-hairline p-3">
                      <span className="text-sm text-ink">Ascenseur</span>
                      <input
                        type="checkbox"
                        checked={hasElevator}
                        onChange={(e) => setHasElevator(e.target.checked)}
                        className="size-5 rounded border-hairline bg-surface accent-accent cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-hairline p-3">
                      <span className="text-sm text-ink">Neuf</span>
                      <input
                        type="checkbox"
                        checked={isNew}
                        onChange={(e) => setIsNew(e.target.checked)}
                        className="size-5 rounded border-hairline bg-surface accent-accent cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-hairline p-3 sm:col-span-2">
                      <span className="text-sm text-ink">Meublé</span>
                      <input
                        type="checkbox"
                        checked={isFurnished}
                        onChange={(e) => setIsFurnished(e.target.checked)}
                        className="size-5 rounded border-hairline bg-surface accent-accent cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-hairline">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? "Enregistrement..." : "Enregistrer les détails"}
                    </Button>
                  </div>
                </form>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SECTION 4 : PIÈCES (Screenshot 3)                             */}
              {/* ------------------------------------------------------------- */}
              {paramSection === "pieces" && (
                <form onSubmit={handleSaveParams} className="space-y-6">
                  <div className="space-y-5">
                    {/* Cuisine */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-ink">Cuisine</h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-ink-muted">Qualité (Optionnel)</Label>
                          <Select
                            value={kitchenQuality}
                            onValueChange={setKitchenQuality}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROOM_QUALITIES.map((q) => (
                                <SelectItem key={q} value={q}>
                                  {ROOM_QUALITY_LABELS[q]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-ink-muted">État (Optionnel)</Label>
                          <Select
                            value={kitchenCondition}
                            onValueChange={setKitchenCondition}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROOM_CONDITIONS.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {ROOM_CONDITION_LABELS[c]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Salle de bain */}
                    <div className="space-y-2 border-t border-hairline pt-4">
                      <h4 className="text-sm font-semibold text-ink">Salle(s) de bains</h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-ink-muted">Qualité (Optionnel)</Label>
                          <Select
                            value={bathroomQuality}
                            onValueChange={setBathroomQuality}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROOM_QUALITIES.map((q) => (
                                <SelectItem key={q} value={q}>
                                  {ROOM_QUALITY_LABELS[q]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-ink-muted">État (Optionnel)</Label>
                          <Select
                            value={bathroomCondition}
                            onValueChange={setBathroomCondition}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROOM_CONDITIONS.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {ROOM_CONDITION_LABELS[c]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Sol */}
                    <div className="space-y-2 border-t border-hairline pt-4">
                      <h4 className="text-sm font-semibold text-ink">Sol</h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-ink-muted">Qualité (Optionnel)</Label>
                          <Select
                            value={flooringQuality}
                            onValueChange={setFlooringQuality}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROOM_QUALITIES.map((q) => (
                                <SelectItem key={q} value={q}>
                                  {ROOM_QUALITY_LABELS[q]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-ink-muted">État (Optionnel)</Label>
                          <Select
                            value={flooringCondition}
                            onValueChange={setFlooringCondition}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROOM_CONDITIONS.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {ROOM_CONDITION_LABELS[c]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Fenêtres */}
                    <div className="space-y-2 border-t border-hairline pt-4">
                      <h4 className="text-sm font-semibold text-ink">Fenêtres</h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-ink-muted">Qualité (Optionnel)</Label>
                          <Select
                            value={windowsQuality}
                            onValueChange={setWindowsQuality}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROOM_QUALITIES.map((q) => (
                                <SelectItem key={q} value={q}>
                                  {ROOM_QUALITY_LABELS[q]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-ink-muted">État (Optionnel)</Label>
                          <Select
                            value={windowsCondition}
                            onValueChange={setWindowsCondition}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROOM_CONDITIONS.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {ROOM_CONDITION_LABELS[c]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* État général */}
                    <div className="space-y-2 border-t border-hairline pt-4">
                      <h4 className="text-sm font-semibold text-ink">État général</h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-ink-muted">Qualité (Optionnel)</Label>
                          <Select
                            value={generalQuality}
                            onValueChange={setGeneralQuality}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROOM_QUALITIES.map((q) => (
                                <SelectItem key={q} value={q}>
                                  {ROOM_QUALITY_LABELS[q]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-ink-muted">État (Optionnel)</Label>
                          <Select
                            value={generalCondition}
                            onValueChange={setGeneralCondition}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROOM_CONDITIONS.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {ROOM_CONDITION_LABELS[c]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-hairline">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? "Enregistrement..." : "Enregistrer les pièces"}
                    </Button>
                  </div>
                </form>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SECTION 5 : EMPRUNTS LIÉS (Screenshot 4)                      */}
              {/* ------------------------------------------------------------- */}
              {paramSection === "emprunts" && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-ink">Emprunts liés</h3>
                      <p className="text-xs text-ink-muted">
                        Ces emprunts sont déduits de la valeur du bien pour calculer votre patrimoine net.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setLinkLoansOpen(true)}
                      className="gap-1.5 text-xs"
                    >
                      <Plus className="size-3.5" />
                      <span>Gérer les emprunts</span>
                    </Button>
                  </div>

                  {property.linkedLoans.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-hairline p-8 text-center text-sm text-ink-muted">
                      Aucun emprunt n&apos;est rattaché à ce bien.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {property.linkedLoans.map((l) => (
                        <div
                          key={l.id}
                          className="flex items-center justify-between rounded-xl border border-hairline bg-surface-muted/20 p-4"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 items-center justify-center rounded-full bg-accent/20 text-accent font-bold">
                              <CreditCard className="size-4" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-ink">
                                {l.name}
                              </p>
                              <p className="text-xs text-ink-muted">
                                {formatCurrency(l.monthlyPayment)}/mois · Échéance {l.endDate}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="flex size-6 items-center justify-center rounded-full bg-surface-elevated text-[11px] font-bold text-ink-muted">
                              {userInitials}
                            </div>
                            <p className="tnum text-base font-bold text-ink">
                              <Montant>{formatCurrency(l.remainingCapital)}</Montant>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SECTION 6 : DÉTENTION (Screenshot 5)                          */}
              {/* ------------------------------------------------------------- */}
              {paramSection === "detention" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">Répartition de la détention</h3>
                    <p className="text-xs text-ink-muted">
                      Quote-part de propriété sur cet actif.
                    </p>
                  </div>

                  <div className="rounded-xl border border-hairline bg-surface-muted/20 p-6 flex flex-col sm:flex-row items-center gap-8 justify-between">
                    <div className="flex items-center gap-6">
                      {/* Donut / Cercle de détention */}
                      <div className="relative flex size-24 items-center justify-center rounded-full border-4 border-accent bg-accent/10">
                        <span className="text-center text-[11px] font-bold text-ink">
                          1 propriétaire
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-surface-elevated text-xs font-bold text-ink">
                          {userInitials}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-ink">{userName}</p>
                          <p className="text-xs text-ink-faint">{userEmail || "Propriétaire principal"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="w-full sm:w-1/3 flex items-center gap-3">
                      <div className="h-3 flex-1 rounded-full bg-surface-elevated overflow-hidden">
                        <div
                          className="h-full bg-accent transition-all"
                          style={{ width: `${ownershipPct}%` }}
                        />
                      </div>
                      <span className="tnum text-sm font-bold text-ink">
                        {ownershipPct}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Label htmlFor="param-ownership">Quote-part (%) :</Label>
                    <Input
                      id="param-ownership"
                      type="number"
                      min="1"
                      max="100"
                      className="w-24 text-center"
                      value={ownershipPct}
                      onChange={(e) => setOwnershipPct(Number(e.target.value))}
                    />
                    <Button
                      size="sm"
                      onClick={() => handleSaveParams()}
                      disabled={isSaving}
                    >
                      Mettre à jour la détention
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Dialogue de gestion des emprunts rattachés */}
      <Dialog open={linkLoansOpen} onOpenChange={setLinkLoansOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rattacher des emprunts</DialogTitle>
            <DialogDescription>
              Sélectionnez les crédits immobiliers finançant ce bien.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-60 overflow-y-auto space-y-2 py-2">
            {availableLoans.length === 0 ? (
              <p className="text-xs text-ink-muted text-center py-4">
                Aucun emprunt enregistré. Créez d&apos;abord un emprunt dans l&apos;onglet Emprunts.
              </p>
            ) : (
              availableLoans.map((loan) => {
                const isSelected = selectedLoanIds.includes(loan.id);
                return (
                  <button
                    key={loan.id}
                    type="button"
                    onClick={() => {
                      setSelectedLoanIds((prev) =>
                        isSelected
                          ? prev.filter((id) => id !== loan.id)
                          : [...prev, loan.id],
                      );
                    }}
                    className={`w-full flex items-center justify-between rounded-lg border p-3 text-left text-xs transition-colors ${
                      isSelected
                        ? "border-accent bg-accent/10"
                        : "border-hairline hover:bg-surface-elevated/40"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex size-5 items-center justify-center rounded border ${
                          isSelected
                            ? "border-accent bg-accent text-canvas"
                            : "border-hairline bg-surface"
                        }`}
                      >
                        {isSelected && <Check className="size-3" />}
                      </div>
                      <div>
                        <p className="font-semibold text-ink">{loan.name}</p>
                        <p className="text-[11px] text-ink-muted">
                          {formatCurrency(loan.monthlyPayment)}/mois
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-ink">
                      <Montant>{formatCurrency(loan.currentRemainingCapital)}</Montant>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Annuler
              </Button>
            </DialogClose>
            <Button onClick={handleSaveLoanLinks} disabled={isSaving}>
              {isSaving ? "Enregistrement..." : "Valider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation de suppression */}
      <DeleteConfirm
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Supprimer ce bien immobilier ?"
        description="Cette action est irréversible. Le bien sera retiré de votre patrimoine (les emprunts rattachés seront conservés sans lien)."
        successMessage="Bien immobilier supprimé"
        redirectTo="/immobilier"
        onConfirm={() => deleteProperty(property.id)}
      />
    </div>
  );
}
