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
} from "@/components/ui";
import { setManualValue } from "@/server/actions";

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

function toField(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "" : String(value);
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-negative text-xs">{message}</p>;
}

/* -------------------------------------------------------------------------- */
/* Types publics                                                               */
/* -------------------------------------------------------------------------- */

export interface ManualValueInitial {
  date: string;
  value: number;
}

export interface ManualValueDialogProps {
  /** Ligne non cotée à revaloriser. */
  holdingId: number;
  /** Libellé de la ligne, rappelé sous le titre. */
  holdingLabel?: string;
  /** Fourni ⇒ pré-remplit une valorisation existante (même date ⇒ écrasement). */
  initial?: ManualValueInitial;
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

function ManualValueForm({
  holdingId,
  initial,
  onDone,
  onSaved,
}: {
  holdingId: number;
  initial?: ManualValueInitial;
  onDone: () => void;
  onSaved?: () => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [date, setDate] = React.useState(initial?.date ?? todayIso());
  const [value, setValue] = React.useState(toField(initial?.value));

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    startTransition(async () => {
      const result = await setManualValue({ holdingId, date, value });
      if (result.ok) {
        setErrors({});
        onDone();
        toast.success("Valorisation enregistrée.");
        onSaved?.();
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="manual-value-date" required>
          Date
        </Label>
        <Input
          id="manual-value-date"
          type="date"
          autoFocus
          value={date}
          onChange={(event) => setDate(event.target.value)}
          max={todayIso()}
          aria-invalid={errors.date ? true : undefined}
        />
        <FieldError message={errors.date} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="manual-value-amount" required>
          Valorisation
        </Label>
        <Input
          id="manual-value-amount"
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="12 480,50"
          aria-invalid={errors.value ? true : undefined}
        />
        {errors.value ? (
          <FieldError message={errors.value} />
        ) : (
          <p className="text-ink-faint text-xs">
            Une valorisation déjà saisie à cette date sera remplacée.
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
          Enregistrer
        </Button>
      </DialogFooter>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Composant                                                                   */
/* -------------------------------------------------------------------------- */

export function ManualValueDialog({
  holdingId,
  holdingLabel,
  initial,
  trigger,
  open: openProp,
  onOpenChange,
  onSaved,
}: ManualValueDialogProps) {
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
          <DialogTitle>Mettre à jour la valorisation</DialogTitle>
          <DialogDescription>
            Saisissez la valeur affichée par votre établissement à cette date.
            {holdingLabel ? ` — ${holdingLabel}` : null}
          </DialogDescription>
        </DialogHeader>

        {/* Le contenu est démonté à la fermeture : le formulaire repart vierge. */}
        <ManualValueForm
          holdingId={holdingId}
          initial={initial}
          onDone={() => setOpen(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}
