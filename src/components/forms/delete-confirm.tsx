"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
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
} from "@/components/ui";

export interface DeleteConfirmProps {
  /** Titre de la boîte, ex. « Supprimer le compte ? ». */
  title: string;
  /**
   * Conséquences de la suppression. C'est à l'appelant d'y mentionner les
   * suppressions en cascade (lignes, transactions, valorisations).
   */
  description: React.ReactNode;
  /** Libellé du bouton destructeur. Par défaut « Supprimer ». */
  confirmLabel?: string;
  /** Message de confirmation affiché en toast. Par défaut « Suppression effectuée. ». */
  successMessage?: string;
  /** Action de suppression — typiquement un `deleteX` du serveur. */
  onConfirm: () => Promise<{ ok: boolean; error?: string }>;
  /**
   * Destination après une suppression réussie. Indispensable quand on supprime
   * l'objet de la page courante, qui deviendrait sinon un 404.
   */
  redirectTo?: string;
  /** Élément déclencheur, enveloppé dans un `DialogTrigger asChild`. */
  trigger?: React.ReactNode;
  /** Mode contrôlé — utilisable à la place (ou en plus) de `trigger`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Appelé après une suppression réussie. */
  onDeleted?: () => void;
}

/* -------------------------------------------------------------------------- */
/* Corps — monté à l'ouverture, donc l'erreur repart à zéro à chaque fois       */
/* -------------------------------------------------------------------------- */

function ConfirmBody({
  confirmLabel,
  successMessage,
  onConfirm,
  redirectTo,
  onDone,
  onDeleted,
}: {
  confirmLabel: string;
  successMessage: string;
  onConfirm: () => Promise<{ ok: boolean; error?: string }>;
  redirectTo?: string;
  onDone: () => void;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function handleConfirm() {
    if (pending) return;
    startTransition(async () => {
      try {
        const result = await onConfirm();
        if (result.ok) {
          setError(null);
          onDone();
          toast.success(successMessage);
          onDeleted?.();
          // L'objet supprimé est celui de la page courante : on quitte la
          // route avant qu'elle ne se revalide en 404.
          if (redirectTo) router.push(redirectTo);
        } else {
          const message = result.error ?? "La suppression a échoué.";
          setError(message);
          toast.error(message);
        }
      } catch {
        const message = "La suppression a échoué. Réessayez.";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <>
      <p className="text-ink-faint text-xs">Cette action est irréversible.</p>

      {error ? <p className="text-negative mt-2 text-xs">{error}</p> : null}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost" disabled={pending}>
            Annuler
          </Button>
        </DialogClose>
        <Button
          type="button"
          variant="danger"
          loading={pending}
          onClick={handleConfirm}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Composant                                                                   */
/* -------------------------------------------------------------------------- */

export function DeleteConfirm({
  title,
  description,
  confirmLabel = "Supprimer",
  successMessage = "Suppression effectuée.",
  onConfirm,
  redirectTo,
  trigger,
  open: openProp,
  onOpenChange,
  onDeleted,
}: DeleteConfirmProps) {
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

      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span
              className="bg-negative-dim text-negative flex size-9 shrink-0 items-center justify-center rounded-xl"
              aria-hidden="true"
            >
              <AlertTriangle className="size-4" />
            </span>
            <div className="flex flex-col gap-1.5">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ConfirmBody
          confirmLabel={confirmLabel}
          successMessage={successMessage}
          onConfirm={onConfirm}
          redirectTo={redirectTo}
          onDone={() => setOpen(false)}
          onDeleted={onDeleted}
        />
      </DialogContent>
    </Dialog>
  );
}
