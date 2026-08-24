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
import { formatCurrency } from "@/lib/format";
import { addTransaction, updateTransaction } from "@/server/actions";
import { TX_TYPE_LABELS, TX_TYPES } from "@/server/actions/schemas";
import type { HoldingKind, TxType } from "@/server/portfolio/types";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Date du jour au format `AAAA-MM-JJ`, en **heure locale**.
 *
 * `toISOString()` bascule en UTC : passé 22 h à Paris, il renvoie la veille et
 * le formulaire s'ouvre pré-rempli sur une date erronée.
 */
function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

/** Lecture « à l'affichage » d'un montant saisi (« 1 234,56 »). */
function readDecimal(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Affiche un nombre venant de la base dans un champ texte, sans « NaN ». */
function toField(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) || value === 0
    ? ""
    : String(value);
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-negative text-xs">{message}</p>;
}

const MANUAL_TYPES: readonly TxType[] = ["DEPOSIT", "WITHDRAWAL"];

/** Confirmation accordée au bon genre — « Vente enregistrée », « Frais enregistrés ». */
const TX_SUCCESS_MESSAGES: Record<TxType, string> = {
  BUY: "Achat enregistré.",
  SELL: "Vente enregistrée.",
  DIVIDEND: "Dividende enregistré.",
  FEE: "Frais enregistrés.",
  DEPOSIT: "Versement enregistré.",
  WITHDRAWAL: "Retrait enregistré.",
};

function isQuantityType(type: TxType): boolean {
  return type === "BUY" || type === "SELL";
}

function isTxType(value: string): value is TxType {
  return (TX_TYPES as readonly string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/* Types publics                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Volontairement structurel : une ligne Drizzle (`type: string`) doit pouvoir
 * être passée telle quelle. Un type inconnu retombe sur le type par défaut.
 */
export interface TransactionInitial {
  id: number;
  type: string;
  date: string;
  quantity?: number | null;
  unitPrice?: number | null;
  fees?: number | null;
  amount?: number | null;
  note?: string | null;
}

export interface TransactionDialogProps {
  /** Ligne à laquelle la transaction se rattache. */
  holdingId: number;
  /** Devise de la ligne — sert au « Montant total ». Par défaut `EUR`. */
  currency?: string;
  /** Une ligne non cotée n'accepte que des versements et des retraits. */
  kind?: HoldingKind;
  /** Fourni ⇒ le formulaire modifie la transaction au lieu d'en créer une. */
  initial?: TransactionInitial;
  /** Élément déclencheur, enveloppé dans un `DialogTrigger asChild`. */
  trigger?: React.ReactNode;
  /** Mode contrôlé — utilisable à la place (ou en plus) de `trigger`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Appelé après un enregistrement réussi. */
  onSaved?: () => void;
}

/* -------------------------------------------------------------------------- */
/* Formulaire — monté à l'ouverture, donc réinitialisé à chaque fois            */
/* -------------------------------------------------------------------------- */

function TransactionForm({
  holdingId,
  currency,
  kind,
  initial,
  onDone,
  onSaved,
}: {
  holdingId: number;
  currency: string;
  kind: HoldingKind;
  initial?: TransactionInitial;
  onDone: () => void;
  onSaved?: () => void;
}) {
  const availableTypes = kind === "MANUAL" ? MANUAL_TYPES : TX_TYPES;
  const defaultType: TxType = kind === "MANUAL" ? "DEPOSIT" : "BUY";

  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const [type, setType] = React.useState<TxType>(
    initial && isTxType(initial.type) ? initial.type : defaultType,
  );
  const [date, setDate] = React.useState(initial?.date ?? todayIso());
  const [quantity, setQuantity] = React.useState(toField(initial?.quantity));
  const [unitPrice, setUnitPrice] = React.useState(toField(initial?.unitPrice));
  const [fees, setFees] = React.useState(toField(initial?.fees));
  const [amount, setAmount] = React.useState(toField(initial?.amount));
  const [note, setNote] = React.useState(initial?.note ?? "");

  const withQuantity = isQuantityType(type);
  const quantityValue = readDecimal(quantity);
  const unitPriceValue = readDecimal(unitPrice);
  const total =
    quantityValue != null && unitPriceValue != null
      ? quantityValue * unitPriceValue + (readDecimal(fees) ?? 0)
      : null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const payload = {
      holdingId,
      type,
      date,
      note: note.trim(),
      ...(withQuantity
        ? { quantity, unitPrice, ...(fees.trim() === "" ? {} : { fees }) }
        : { amount }),
    };

    startTransition(async () => {
      const result = initial
        ? await updateTransaction(initial.id, payload)
        : await addTransaction(payload);

      if (result.ok) {
        setErrors({});
        onDone();
        toast.success(
          initial ? "Transaction mise à jour." : TX_SUCCESS_MESSAGES[type],
        );
        onSaved?.();
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Type */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-type" required>
          Type d&apos;opération
        </Label>
        <Select
          value={type}
          onValueChange={(value) => {
            if (isTxType(value)) setType(value);
            setErrors({});
          }}
        >
          <SelectTrigger
            id="tx-type"
            autoFocus
            aria-invalid={errors.type ? true : undefined}
          >
            <SelectValue placeholder="Choisir un type" />
          </SelectTrigger>
          <SelectContent>
            {availableTypes.map((value) => (
              <SelectItem key={value} value={value}>
                {TX_TYPE_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={errors.type} />
      </div>

      {/* Date */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-date" required>
          Date
        </Label>
        <Input
          id="tx-date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          max={todayIso()}
          aria-invalid={errors.date ? true : undefined}
        />
        <FieldError message={errors.date} />
      </div>

      {withQuantity ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tx-quantity" required>
                Quantité
              </Label>
              <Input
                id="tx-quantity"
                inputMode="decimal"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="12"
                aria-invalid={errors.quantity ? true : undefined}
              />
              <FieldError message={errors.quantity} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tx-price" required>
                Prix unitaire
              </Label>
              <Input
                id="tx-price"
                inputMode="decimal"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
                placeholder="412,50"
                aria-invalid={errors.unitPrice ? true : undefined}
              />
              <FieldError message={errors.unitPrice} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-fees">Frais</Label>
            <Input
              id="tx-fees"
              inputMode="decimal"
              value={fees}
              onChange={(event) => setFees(event.target.value)}
              placeholder="0"
              aria-invalid={errors.fees ? true : undefined}
            />
            <FieldError message={errors.fees} />
          </div>

          <div className="bg-surface-2 border-hairline flex items-center justify-between rounded-xl border px-3 py-2.5">
            <span className="text-ink-muted text-[13px]">Montant total</span>
            <span className="tnum text-ink text-sm font-semibold">
              {formatCurrency(total, currency, { decimals: 2 })}
            </span>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tx-amount" required>
            Montant
          </Label>
          <Input
            id="tx-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="250"
            aria-invalid={errors.amount ? true : undefined}
          />
          {errors.amount ? (
            <FieldError message={errors.amount} />
          ) : (
            <p className="text-ink-faint text-xs">
              Montant en {currency}, toujours positif.
            </p>
          )}
        </div>
      )}

      {/* Note */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-note">Note</Label>
        <Textarea
          id="tx-note"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={200}
          placeholder="Facultatif"
          aria-invalid={errors.note ? true : undefined}
        />
        <FieldError message={errors.note} />
      </div>

      <FieldError message={errors._} />

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost" disabled={pending}>
            Annuler
          </Button>
        </DialogClose>
        <Button type="submit" loading={pending}>
          {initial ? "Enregistrer" : "Ajouter"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Composant                                                                   */
/* -------------------------------------------------------------------------- */

export function TransactionDialog({
  holdingId,
  currency = "EUR",
  kind = "QUOTED",
  initial,
  trigger,
  open: openProp,
  onOpenChange,
  onSaved,
}: TransactionDialogProps) {
  const [uncontrolled, setUncontrolled] = React.useState(false);
  const open = openProp ?? uncontrolled;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initial ? "Modifier la transaction" : "Nouvelle transaction"}
          </DialogTitle>
          <DialogDescription>
            {kind === "MANUAL"
              ? "Enregistrez un versement ou un retrait sur cette ligne."
              : "Achat, vente, dividende ou frais — les montants alimentent le prix de revient."}
          </DialogDescription>
        </DialogHeader>

        {/* Le contenu est démonté à la fermeture : le formulaire repart vierge. */}
        <TransactionForm
          holdingId={holdingId}
          currency={currency}
          kind={kind}
          initial={initial}
          onDone={() => setOpen(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}
