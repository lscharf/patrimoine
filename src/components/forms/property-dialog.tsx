"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/components/ui";
import {
  createProperty,
  updateProperty,
  type ActionResult,
} from "@/server/actions";
import {
  PROPERTY_CATEGORIES,
  PROPERTY_CATEGORY_LABELS,
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPES,
} from "@/server/actions/schemas";
import type { PropertyCategory, PropertySummary, PropertyType } from "@/server/real-estate/types";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-negative">{message}</p>;
}

export interface PropertyDialogProps {
  initial?: PropertySummary;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved?: (propertyId?: number) => void;
}

function PropertyForm({
  initial,
  onDone,
  onSaved,
}: {
  initial?: PropertySummary;
  onDone: () => void;
  onSaved?: (propertyId?: number) => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const [name, setName] = React.useState(initial?.name ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [type, setType] = React.useState<PropertyType>(initial?.type ?? "APPARTEMENT");
  const [category, setCategory] = React.useState<PropertyCategory>(
    initial?.category ?? "RESIDENCE_PRINCIPALE",
  );
  const [address, setAddress] = React.useState(initial?.address ?? "");
  const [surface, setSurface] = React.useState(
    initial ? String(initial.surface) : "60",
  );
  const [purchasePrice, setPurchasePrice] = React.useState(
    initial ? String(initial.purchasePrice) : "200000",
  );
  const [purchaseDate, setPurchaseDate] = React.useState(
    initial?.purchaseDate ?? "",
  );
  const [notaryFees, setNotaryFees] = React.useState(
    initial?.notaryFees ? String(initial.notaryFees) : "",
  );
  const [renovationCosts, setRenovationCosts] = React.useState(
    initial?.renovationCosts ? String(initial.renovationCosts) : "",
  );
  const [estimatedValue, setEstimatedValue] = React.useState(
    initial ? String(initial.estimatedValue) : "220000",
  );
  const [monthlyRent, setMonthlyRent] = React.useState(
    initial?.monthlyRent ? String(initial.monthlyRent) : "",
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const payload = {
      name,
      description: description || undefined,
      type,
      category,
      address: address || undefined,
      surface: surface.replace(",", "."),
      purchasePrice: purchasePrice.replace(",", "."),
      purchaseDate: purchaseDate || undefined,
      notaryFees: notaryFees ? notaryFees.replace(",", ".") : "0",
      renovationCosts: renovationCosts ? renovationCosts.replace(",", ".") : "0",
      estimatedValue: estimatedValue.replace(",", "."),
      monthlyRent: monthlyRent ? monthlyRent.replace(",", ".") : "0",
      rooms: initial?.rooms ?? 3,
      bedrooms: initial?.bedrooms ?? 2,
      bathrooms: initial?.bathrooms ?? 1,
      garages: initial?.garages ?? 0,
      parkingSpots: initial?.parkingSpots ?? 0,
      gardenSurface: initial?.gardenSurface ?? 0,
      terraceSurface: initial?.terraceSurface ?? 0,
      hasElevator: initial?.hasElevator ?? false,
      isNew: initial?.isNew ?? false,
      isFurnished: initial?.isFurnished ?? false,
      ownershipPct: initial?.ownershipPct ?? 100,
    };

    startTransition(async () => {
      let result: ActionResult<number> | ActionResult;
      if (initial?.id) {
        result = await updateProperty(initial.id, payload);
      } else {
        result = await createProperty(payload);
      }

      if (result.ok) {
        toast.success(
          initial?.id ? "Bien immobilier mis à jour" : "Bien immobilier ajouté avec succès",
        );
        onDone();
        if ("data" in result && result.data) {
          onSaved?.(result.data);
        } else {
          onSaved?.(initial?.id);
        }
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="prop-name">Nom ou adresse du bien</Label>
          <Input
            id="prop-name"
            placeholder="Ex : 1 Rue de la Robertsau, 67300 Schiltigheim..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <FieldError message={errors.name} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="prop-type">Type de bien</Label>
          <Select value={type} onValueChange={(val) => setType(val as PropertyType)}>
            <SelectTrigger id="prop-type">
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
          <FieldError message={errors.type} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="prop-cat">Usage / Catégorie</Label>
          <Select value={category} onValueChange={(val) => setCategory(val as PropertyCategory)}>
            <SelectTrigger id="prop-cat">
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
          <FieldError message={errors.category} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="prop-address">Adresse complète (optionnel)</Label>
          <Input
            id="prop-address"
            placeholder="Ex : 1 Rue de la Robertsau, 67300 Schiltigheim"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="prop-surface">Surface habitable (m²)</Label>
          <Input
            id="prop-surface"
            type="text"
            inputMode="decimal"
            placeholder="Ex : 63"
            value={surface}
            onChange={(e) => setSurface(e.target.value)}
            required
          />
          <FieldError message={errors.surface} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="prop-val">Valeur estimée actuelle (€)</Label>
          <Input
            id="prop-val"
            type="text"
            inputMode="decimal"
            placeholder="Ex : 255 000"
            value={estimatedValue}
            onChange={(e) => setEstimatedValue(e.target.value)}
            required
          />
          <FieldError message={errors.estimatedValue} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="prop-price">Prix d&apos;achat (€)</Label>
          <Input
            id="prop-price"
            type="text"
            inputMode="decimal"
            placeholder="Ex : 220 000"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            required
          />
          <FieldError message={errors.purchasePrice} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="prop-date">Date d&apos;achat</Label>
          <Input
            id="prop-date"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="prop-notary">Frais de notaire (€)</Label>
          <Input
            id="prop-notary"
            type="text"
            inputMode="decimal"
            placeholder="Ex : 16 000"
            value={notaryFees}
            onChange={(e) => setNotaryFees(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="prop-reno">Travaux réalisés (€)</Label>
          <Input
            id="prop-reno"
            type="text"
            inputMode="decimal"
            placeholder="Ex : 10 000"
            value={renovationCosts}
            onChange={(e) => setRenovationCosts(e.target.value)}
          />
        </div>

        {category === "LOCATIF" && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="prop-rent">Loyer mensuel perçu (€/mois)</Label>
            <Input
              id="prop-rent"
              type="text"
              inputMode="decimal"
              placeholder="Ex : 850"
              value={monthlyRent}
              onChange={(e) => setMonthlyRent(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="prop-desc">Description / Notes (optionnel)</Label>
          <Textarea
            id="prop-desc"
            placeholder="Étage, orientation, travaux prévus, garage..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={pending}>
            Annuler
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Enregistrement..."
            : initial?.id
              ? "Mettre à jour"
              : "Ajouter le bien"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function PropertyDialog({
  initial,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onSaved,
}: PropertyDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const isEditing = Boolean(initial?.id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier le bien immobilier" : "Nouveau bien immobilier"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Mettez à jour les informations principales de votre actif immobilier."
              : "Renseignez votre bien pour l'intégrer à votre patrimoine et déduire les crédits associés."}
          </DialogDescription>
        </DialogHeader>

        <PropertyForm
          initial={initial}
          onDone={() => setOpen(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}
