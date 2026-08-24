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
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { createAccount, updateAccount } from "@/server/actions";
import { ACCOUNT_KIND_LABELS, ACCOUNT_KINDS } from "@/server/actions/schemas";

type AccountKind = (typeof ACCOUNT_KINDS)[number];

/* -------------------------------------------------------------------------- */
/* Palette — lue depuis les jetons CSS, jamais codée en dur                     */
/* -------------------------------------------------------------------------- */

const CHART_TOKENS = [
  "--color-chart-1",
  "--color-chart-2",
  "--color-chart-3",
  "--color-chart-4",
  "--color-chart-5",
  "--color-chart-6",
  "--color-chart-7",
  "--color-chart-8",
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Résout les jetons `--color-chart-*` en valeurs hexadécimales exploitables. */
function readPalette(): string[] {
  if (typeof window === "undefined") return [];
  const style = window.getComputedStyle(document.documentElement);
  return CHART_TOKENS.map((token) => style.getPropertyValue(token).trim()).map(
    (value) => (HEX.test(value) ? value : ""),
  );
}

function isAccountKind(value: string): value is AccountKind {
  return (ACCOUNT_KINDS as readonly string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/* Types publics                                                               */
/* -------------------------------------------------------------------------- */

export interface AccountInitial {
  id: number;
  name: string;
  kind: string;
  institution?: string | null;
  color?: string | null;
}

export interface AccountDialogProps {
  /** Fourni ⇒ le formulaire modifie le compte au lieu d'en créer un. */
  initial?: AccountInitial;
  /** Élément déclencheur, enveloppé dans un `DialogTrigger asChild`. */
  trigger?: React.ReactNode;
  /** Mode contrôlé — utilisable à la place (ou en plus) de `trigger`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Appelé après un enregistrement réussi. */
  onSaved?: (id?: number) => void;
}

/* -------------------------------------------------------------------------- */
/* Formulaire — monté à l'ouverture, donc réinitialisé à chaque fois            */
/* -------------------------------------------------------------------------- */

function AccountForm({
  initial,
  onDone,
  onSaved,
}: {
  initial?: AccountInitial;
  onDone: () => void;
  onSaved?: (id?: number) => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const [name, setName] = React.useState(initial?.name ?? "");
  const [kind, setKind] = React.useState<AccountKind>(
    initial && isAccountKind(initial.kind) ? initial.kind : "PEA",
  );
  const [institution, setInstitution] = React.useState(
    initial?.institution ?? "",
  );

  /** Index dans `CHART_TOKENS`, ou `-1` pour la couleur déjà enregistrée. */
  const [colorIndex, setColorIndex] = React.useState(() => {
    const existing = initial?.color;
    if (!existing || !HEX.test(existing)) return 0;
    return readPalette().findIndex(
      (value) => value.toLowerCase() === existing.toLowerCase(),
    );
  });
  const [customColor] = React.useState(() => {
    const existing = initial?.color;
    if (!existing || !HEX.test(existing)) return null;
    const found = readPalette().some(
      (value) => value.toLowerCase() === existing.toLowerCase(),
    );
    return found ? null : existing;
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const palette = readPalette();
    const picked =
      colorIndex >= 0 ? palette[colorIndex] || undefined : customColor ?? undefined;

    const payload = {
      name,
      kind,
      institution: institution.trim(),
      ...(picked ? { color: picked } : {}),
    };

    startTransition(async () => {
      if (initial) {
        const result = await updateAccount(initial.id, payload);
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          toast.error(result.error);
          return;
        }
        setErrors({});
        onDone();
        toast.success("Compte mis à jour.");
        onSaved?.(initial.id);
        return;
      }

      const result = await createAccount(payload);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setErrors({});
      onDone();
      toast.success(`Compte « ${name.trim()} » créé.`);
      onSaved?.(result.data);
    });
  }

  const swatchClass = (selected: boolean) =>
    cn(
      "size-8 rounded-full transition-transform duration-150",
      "focus-visible:ring-accent/70 focus-visible:ring-offset-surface outline-none",
      "focus-visible:ring-2 focus-visible:ring-offset-2",
      selected
        ? "ring-ink ring-offset-surface scale-105 ring-2 ring-offset-2"
        : "hover:scale-105",
    );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Nom */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-name" required>
          Nom du compte
        </Label>
        <Input
          id="account-name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="PEA Bourse Direct"
          maxLength={80}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "account-name-error" : undefined}
        />
        {errors.name ? (
          <p id="account-name-error" className="text-negative text-xs">
            {errors.name}
          </p>
        ) : null}
      </div>

      {/* Type */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-kind" required>
          Type
        </Label>
        <Select
          value={kind}
          onValueChange={(value) => {
            if (isAccountKind(value)) setKind(value);
          }}
        >
          <SelectTrigger
            id="account-kind"
            aria-invalid={errors.kind ? true : undefined}
          >
            <SelectValue placeholder="Choisir un type" />
          </SelectTrigger>
          <SelectContent>
            {ACCOUNT_KINDS.map((value) => (
              <SelectItem key={value} value={value}>
                {ACCOUNT_KIND_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.kind ? (
          <p className="text-negative text-xs">{errors.kind}</p>
        ) : null}
      </div>

      {/* Établissement */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-institution">Établissement</Label>
        <Input
          id="account-institution"
          value={institution}
          onChange={(event) => setInstitution(event.target.value)}
          placeholder="Boursorama, Fortuneo, Binance…"
          maxLength={80}
          aria-invalid={errors.institution ? true : undefined}
        />
        {errors.institution ? (
          <p className="text-negative text-xs">{errors.institution}</p>
        ) : (
          <p className="text-ink-faint text-xs">Facultatif.</p>
        )}
      </div>

      {/* Couleur */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-ink-muted mb-2 text-[13px] leading-none font-medium">
          Couleur
        </legend>
        <div className="flex flex-wrap items-center gap-2">
          {customColor ? (
            <button
              type="button"
              aria-label="Couleur actuelle du compte"
              aria-pressed={colorIndex === -1}
              onClick={() => setColorIndex(-1)}
              style={{ backgroundColor: customColor }}
              className={swatchClass(colorIndex === -1)}
            />
          ) : null}
          {CHART_TOKENS.map((token, index) => (
            <button
              key={token}
              type="button"
              aria-label={`Couleur ${index + 1}`}
              aria-pressed={colorIndex === index}
              onClick={() => setColorIndex(index)}
              style={{ backgroundColor: `var(${token})` }}
              className={swatchClass(colorIndex === index)}
            />
          ))}
        </div>
        {errors.color ? (
          <p className="text-negative text-xs">{errors.color}</p>
        ) : (
          <p className="text-ink-faint text-xs">
            Utilisée dans les graphiques et la liste des comptes.
          </p>
        )}
      </fieldset>

      {errors._ ? <p className="text-negative text-xs">{errors._}</p> : null}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost" disabled={pending}>
            Annuler
          </Button>
        </DialogClose>
        <Button type="submit" loading={pending}>
          {initial ? "Enregistrer" : "Créer le compte"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Composant                                                                   */
/* -------------------------------------------------------------------------- */

export function AccountDialog({
  initial,
  trigger,
  open: openProp,
  onOpenChange,
  onSaved,
}: AccountDialogProps) {
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
            {initial ? "Modifier le compte" : "Nouveau compte"}
          </DialogTitle>
          <DialogDescription>
            {initial
              ? "Renommez le compte, changez son type ou sa couleur."
              : "Un compte regroupe des lignes : PEA, assurance-vie, livret, portefeuille crypto…"}
          </DialogDescription>
        </DialogHeader>

        {/* Le contenu est démonté à la fermeture : le formulaire repart vierge. */}
        <AccountForm
          initial={initial}
          onDone={() => setOpen(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}
