"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  Badge,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/ui";
import { Montant } from "@/components/privacy/amount";
import { formatCurrency } from "@/lib/format";
import {
  createManualHolding,
  createQuotedHolding,
  updateHolding,
} from "@/server/actions";
import type { SearchHit } from "@/server/prices/provider";

import { InstrumentSearch } from "./instrument-search";

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

/**
 * Lecture « à l'affichage » d'un montant saisi (« 1 234,56 »).
 * La valeur brute reste envoyée au serveur, qui fait foi.
 */
function readDecimal(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-negative text-xs">{message}</p>;
}

type SaveResult =
  | { ok: true; data?: number }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/* -------------------------------------------------------------------------- */
/* Types publics                                                               */
/* -------------------------------------------------------------------------- */

export type HoldingMode = "quoted" | "manual";

export interface HoldingInitial {
  id: number;
  label: string;
  note?: string | null;
  symbol?: string | null;
  kind?: string;
  currency?: string;
}
export interface HoldingDialogProps {
  /** Compte auquel la ligne est rattachée. */
  accountId: number;
  /** Nom du compte, affiché dans le titre : « Ajouter une ligne — PEA ». */
  accountName?: string;
  /** Onglet ouvert par défaut. */
  defaultMode?: HoldingMode;
  /**
   * Fourni ⇒ le formulaire modifie la ligne (libellé et note) au lieu d'en
   * créer une : les transactions se gèrent depuis `TransactionDialog`.
   */
  initial?: HoldingInitial;
  /** Élément déclencheur, enveloppé dans un `DialogTrigger asChild`. */
  trigger?: React.ReactNode;
  /** Mode contrôlé — utilisable à la place (ou en plus) de `trigger`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Appelé après un enregistrement réussi. */
  onSaved?: (holdingId?: number) => void;
}

/* -------------------------------------------------------------------------- */
/* Sous-formulaires                                                            */
/* -------------------------------------------------------------------------- */

function useSave(onDone: () => void, onSaved?: (id?: number) => void) {
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const save = React.useCallback(
    (action: () => Promise<SaveResult>, success: string) => {
      startTransition(async () => {
        const result = await action();
        if (result.ok) {
          setErrors({});
          onDone();
          toast.success(success);
          onSaved?.(result.data);
        } else {
          setErrors(result.fieldErrors ?? {});
          toast.error(result.error);
        }
      });
    },
    [onDone, onSaved],
  );

  return { pending, errors, save };
}

function QuotedForm({
  accountId,
  autoFocus,
  onDone,
  onSaved,
}: {
  accountId: number;
  autoFocus: boolean;
  onDone: () => void;
  onSaved?: (id?: number) => void;
}) {
  const { pending, errors, save } = useSave(onDone, onSaved);

  const [instrument, setInstrument] = React.useState<SearchHit | null>(null);
  const [label, setLabel] = React.useState("");
  const [date, setDate] = React.useState(todayIso);
  const [quantity, setQuantity] = React.useState("");
  const [unitPrice, setUnitPrice] = React.useState("");
  const [fees, setFees] = React.useState("");

  const currency = instrument?.currency ?? "EUR";
  const quantityValue = readDecimal(quantity);
  const unitPriceValue = readDecimal(unitPrice);
  const total =
    quantityValue != null && unitPriceValue != null
      ? quantityValue * unitPriceValue + (readDecimal(fees) ?? 0)
      : null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    save(
      () =>
        createQuotedHolding({
          accountId,
          symbol: instrument?.symbol ?? "",
          label: label.trim(),
          date,
          quantity,
          unitPrice,
          ...(fees.trim() === "" ? {} : { fees }),
        }),
      `Ligne « ${label.trim() || instrument?.symbol || "titre"} » ajoutée.`,
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <InstrumentSearch
        id="holding-instrument"
        value={instrument}
        onSelect={setInstrument}
        onClear={() => setInstrument(null)}
        error={errors.symbol || undefined}
        autoFocus={autoFocus}
        disabled={pending}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="holding-label">Libellé personnalisé</Label>
        <Input
          id="holding-label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={instrument?.name ?? "Nom affiché dans la liste"}
          maxLength={80}
          aria-invalid={errors.label ? true : undefined}
        />
        {errors.label ? (
          <FieldError message={errors.label} />
        ) : (
          <p className="text-ink-faint text-xs">
            Facultatif — le nom officiel est utilisé par défaut.
          </p>
        )}
      </div>

      <p className="text-ink-muted text-[13px]">Premier achat</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="holding-date" required>
            Date
          </Label>
          <Input
            id="holding-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            max={todayIso()}
            aria-invalid={errors.date ? true : undefined}
          />
          <FieldError message={errors.date} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="holding-quantity" required>
            Quantité
          </Label>
          <Input
            id="holding-quantity"
            inputMode="decimal"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="12"
            aria-invalid={errors.quantity ? true : undefined}
          />
          <FieldError message={errors.quantity} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="holding-price" required>
            Prix unitaire
          </Label>
          <Input
            id="holding-price"
            inputMode="decimal"
            value={unitPrice}
            onChange={(event) => setUnitPrice(event.target.value)}
            placeholder="412,50"
            aria-invalid={errors.unitPrice ? true : undefined}
          />
          <FieldError message={errors.unitPrice} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="holding-fees">Frais</Label>
          <Input
            id="holding-fees"
            inputMode="decimal"
            value={fees}
            onChange={(event) => setFees(event.target.value)}
            placeholder="0"
            aria-invalid={errors.fees ? true : undefined}
          />
          <FieldError message={errors.fees} />
        </div>
      </div>

      <div className="bg-surface-2 border-hairline flex items-center justify-between rounded-xl border px-3 py-2.5">
        <span className="text-ink-muted text-[13px]">Montant total</span>
        <span className="tnum text-ink text-sm font-semibold">
          <Montant>{formatCurrency(total, currency, { decimals: 2 })}</Montant>
        </span>
      </div>

      <FieldError message={errors._} />

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost" disabled={pending}>
            Annuler
          </Button>
        </DialogClose>
        <Button type="submit" loading={pending}>
          Ajouter la ligne
        </Button>
      </DialogFooter>
    </form>
  );
}

function ManualForm({
  accountId,
  autoFocus,
  onDone,
  onSaved,
}: {
  accountId: number;
  autoFocus: boolean;
  onDone: () => void;
  onSaved?: (id?: number) => void;
}) {
  const { pending, errors, save } = useSave(onDone, onSaved);

  const [label, setLabel] = React.useState("");
  const [date, setDate] = React.useState(todayIso);
  const [amount, setAmount] = React.useState("");
  const [valuation, setValuation] = React.useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    save(
      () =>
        createManualHolding({
          accountId,
          label,
          date,
          amount,
          ...(valuation.trim() === "" ? {} : { value: valuation }),
        }),
      `Ligne « ${label.trim() || "non cotée"} » ajoutée.`,
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-ink-muted text-[13px] leading-relaxed">
        Pour un PEE, un livret ou des parts sociales — vous saisirez vous-même la
        valorisation.
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="manual-label" required>
          Libellé
        </Label>
        <Input
          id="manual-label"
          autoFocus={autoFocus}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="PEE Amundi, Livret A…"
          maxLength={80}
          aria-invalid={errors.label ? true : undefined}
        />
        <FieldError message={errors.label} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="manual-date" required>
            Date
          </Label>
          <Input
            id="manual-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            max={todayIso()}
            aria-invalid={errors.date ? true : undefined}
          />
          <FieldError message={errors.date} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="manual-amount" required>
            Montant versé
          </Label>
          <Input
            id="manual-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="5 000"
            aria-invalid={errors.amount ? true : undefined}
          />
          <FieldError message={errors.amount} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="manual-value">Valorisation actuelle</Label>
        <Input
          id="manual-value"
          inputMode="decimal"
          value={valuation}
          onChange={(event) => setValuation(event.target.value)}
          placeholder="5 240"
          aria-invalid={errors.value ? true : undefined}
        />
        {errors.value ? (
          <FieldError message={errors.value} />
        ) : (
          <p className="text-ink-faint text-xs">
            Laissez vide si la valeur est égale au versement.
          </p>
        )}
      </div>

      <FieldError message={errors._} />

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost" disabled={pending}>
            Annuler
          </Button>
        </DialogClose>
        <Button type="submit" loading={pending}>
          Ajouter la ligne
        </Button>
      </DialogFooter>
    </form>
  );
}

function EditForm({
  initial,
  onDone,
  onSaved,
}: {
  initial: HoldingInitial;
  onDone: () => void;
  onSaved?: (holdingId?: number) => void;
}) {
  const { pending, errors, save } = useSave(onDone, onSaved);
  const [label, setLabel] = React.useState(initial.label);
  const [note, setNote] = React.useState(initial.note ?? "");
  const [symbol, setSymbol] = React.useState<string | null>(
    initial.symbol ?? null,
  );
  const [changingTicker, setChangingTicker] = React.useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    save(
      () =>
        updateHolding(initial.id, {
          label,
          note: note.trim(),
          symbol: symbol || null,
        }),
      "Ligne mise à jour.",
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="holding-edit-label" required>
          Libellé
        </Label>
        <Input
          id="holding-edit-label"
          autoFocus
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={80}
          aria-invalid={errors.label ? true : undefined}
        />
        <FieldError message={errors.label} />
      </div>

      {/* Setting : Ticker coté associé */}
      <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-muted/30 p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-ink">
            Ticker & Cotation en direct
          </span>
          {symbol && !changingTicker && (
            <Badge variant="accent" className="font-mono text-[11px]">
              {symbol}
            </Badge>
          )}
        </div>

        {changingTicker ? (
          <div className="space-y-2 pt-1">
            <p className="text-[11px] text-ink-muted">
              Recherchez une action, un ETF, une crypto ou un fonds (ex: CW8.PA, AAPL, 0P0000TQBU.F...) :
            </p>
            <InstrumentSearch
              onSelect={(hit) => {
                setSymbol(hit.symbol);
                if (!label || label === initial.label) {
                  setLabel(hit.name);
                }
                setChangingTicker(false);
              }}
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setChangingTicker(false)}
              >
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-ink-muted text-[11px]">
              {symbol
                ? `Cotation automatique via le symbole ${symbol}`
                : "Aucun ticker lié (ligne en valorisation manuelle)"}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setChangingTicker(true)}
              >
                {symbol ? "Modifier le ticker" : "Lier un ticker"}
              </Button>
              {symbol && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-negative hover:bg-negative/10"
                  onClick={() => setSymbol(null)}
                >
                  Dissocier
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="holding-edit-note">Note</Label>
        <Textarea
          id="holding-edit-note"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          placeholder="Stratégie, échéance, remarque…"
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
          Enregistrer
        </Button>
      </DialogFooter>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Composant                                                                   */
/* -------------------------------------------------------------------------- */

function NewHoldingTabs({
  accountId,
  defaultMode,
  onDone,
  onSaved,
}: {
  accountId: number;
  defaultMode: HoldingMode;
  onDone: () => void;
  onSaved?: (holdingId?: number) => void;
}) {
  const [mode, setMode] = React.useState<HoldingMode>(defaultMode);

  return (
    <Tabs value={mode} onValueChange={(value) => setMode(value as HoldingMode)}>
      <TabsList>
        <TabsTrigger value="quoted">Titre coté</TabsTrigger>
        <TabsTrigger value="manual">Non coté</TabsTrigger>
      </TabsList>

      <TabsContent value="quoted">
        <QuotedForm
          accountId={accountId}
          autoFocus={mode === "quoted"}
          onDone={onDone}
          onSaved={onSaved}
        />
      </TabsContent>

      <TabsContent value="manual">
        <ManualForm
          accountId={accountId}
          autoFocus={mode === "manual"}
          onDone={onDone}
          onSaved={onSaved}
        />
      </TabsContent>
    </Tabs>
  );
}

export function HoldingDialog({
  accountId,
  accountName,
  defaultMode = "quoted",
  initial,
  trigger,
  open: openProp,
  onOpenChange,
  onSaved,
}: HoldingDialogProps) {
  const [uncontrolled, setUncontrolled] = React.useState(false);
  const open = openProp ?? uncontrolled;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );
  const close = React.useCallback(() => setOpen(false), [setOpen]);

  const title = initial
    ? "Modifier la ligne"
    : accountName
      ? `Ajouter une ligne — ${accountName}`
      : "Ajouter une ligne";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {initial
              ? "Renommez la ligne ou ajoutez une note personnelle."
              : "Un titre coté est valorisé automatiquement ; une ligne non cotée est saisie à la main."}
          </DialogDescription>
        </DialogHeader>

        {/* Le contenu est démonté à la fermeture : le formulaire repart vierge. */}
        {initial ? (
          <EditForm initial={initial} onDone={close} onSaved={onSaved} />
        ) : (
          <NewHoldingTabs
            accountId={accountId}
            defaultMode={defaultMode}
            onDone={close}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
