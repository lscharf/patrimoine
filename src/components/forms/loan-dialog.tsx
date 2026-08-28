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
import { Montant } from "@/components/privacy/amount";
import { formatCurrency } from "@/lib/format";
import { createLoan, updateLoan, type ActionResult } from "@/server/actions";
import { LOAN_KIND_LABELS, LOAN_KINDS } from "@/server/actions/schemas";
import {
  calculateBaseMonthlyPayment,
  calculateMonthlyInsurance,
} from "@/server/loans/amortization";
import type { LoanSummary, LoanType } from "@/server/loans/types";

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

function readDecimal(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-negative">{message}</p>;
}

export interface LoanInitial {
  id: number;
  name: string;
  type: LoanType;
  borrowedAmount: number;
  downPayment: number;
  initialFees: number;
  interestRate: number;
  insuranceRate: number;
  durationMonths: number;
  startDate: string;
  customMonthlyPayment?: number | null;
  currentBalance?: number | null;
  groupName?: string | null;
  accountId?: number | null;
  notes?: string | null;
}

export interface LoanDialogProps {
  initial?: LoanInitial | LoanSummary;
  accounts?: Array<{ id: number; name: string }>;
  availableGroupNames?: string[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved?: (loanId?: number) => void;
}

function LoanForm({
  initial,
  accounts = [],
  availableGroupNames = [],
  onDone,
  onSaved,
}: {
  initial?: LoanInitial | LoanSummary;
  accounts?: Array<{ id: number; name: string }>;
  availableGroupNames?: string[];
  onDone: () => void;
  onSaved?: (loanId?: number) => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const [name, setName] = React.useState(initial?.name ?? "");
  const [type, setType] = React.useState<LoanType>(initial?.type ?? "AMORTIZING");
  const [borrowedAmount, setBorrowedAmount] = React.useState(
    initial ? String(initial.borrowedAmount) : "",
  );
  const [downPayment, setDownPayment] = React.useState(
    initial?.downPayment ? String(initial.downPayment) : "",
  );
  const [initialFees, setInitialFees] = React.useState(
    initial?.initialFees ? String(initial.initialFees) : "",
  );
  const [interestRate, setInterestRate] = React.useState(
    initial ? String(initial.interestRate) : "3.5",
  );
  const [insuranceRate, setInsuranceRate] = React.useState(
    initial?.insuranceRate ? String(initial.insuranceRate) : "0.36",
  );
  const [durationMonths, setDurationMonths] = React.useState(
    initial ? String(initial.durationMonths) : "180",
  );
  const [startDate, setStartDate] = React.useState(initial?.startDate ?? todayIso());
  const [customMonthlyPayment, setCustomMonthlyPayment] = React.useState(
    initial?.customMonthlyPayment ? String(initial.customMonthlyPayment) : "",
  );
  const [currentBalance, setCurrentBalance] = React.useState(
    initial?.currentBalance != null ? String(initial.currentBalance) : "",
  );
  const [groupName, setGroupName] = React.useState(initial?.groupName ?? "");
  const [accountId, setAccountId] = React.useState<string>(
    initial?.accountId ? String(initial.accountId) : "none",
  );
  const [notes, setNotes] = React.useState(initial?.notes ?? "");

  // Calcul dynamique de la mensualité estimée
  const numAmount = readDecimal(borrowedAmount) ?? 0;
  const numRate = readDecimal(interestRate) ?? 0;
  const numInsurance = readDecimal(insuranceRate) ?? 0;
  const numMonths = Math.max(1, parseInt(durationMonths, 10) || 0);

  const estimatedBase = calculateBaseMonthlyPayment(numAmount, numRate, numMonths, type);
  const estimatedInsurance = calculateMonthlyInsurance(numAmount, numInsurance);
  const estimatedTotal = estimatedBase + estimatedInsurance;

  const durationYears = (numMonths / 12).toFixed(1).replace(/\.0$/, "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const payload = {
      name,
      type,
      borrowedAmount: borrowedAmount.replace(",", "."),
      downPayment: downPayment ? downPayment.replace(",", ".") : "0",
      initialFees: initialFees ? initialFees.replace(",", ".") : "0",
      interestRate: interestRate.replace(",", "."),
      insuranceRate: insuranceRate ? insuranceRate.replace(",", ".") : "0",
      durationMonths: parseInt(durationMonths, 10),
      startDate,
      customMonthlyPayment: customMonthlyPayment
        ? customMonthlyPayment.replace(",", ".")
        : undefined,
      currentBalance: currentBalance
        ? currentBalance.replace(",", ".")
        : undefined,
      groupName: groupName.trim() || undefined,
      accountId: accountId !== "none" ? Number(accountId) : null,
      notes: notes || undefined,
    };

    startTransition(async () => {
      let result: ActionResult<number> | ActionResult;
      if (initial?.id) {
        result = await updateLoan(initial.id, payload);
      } else {
        result = await createLoan(payload);
      }

      if (result.ok) {
        toast.success(
          initial?.id ? "Emprunt mis à jour" : "Emprunt ajouté avec succès",
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
          <Label htmlFor="loan-name">Nom de l&apos;emprunt</Label>
          <Input
            id="loan-name"
            placeholder="Ex : Prêt Immobilier Résidence Principale, Prêt Conso..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <FieldError message={errors.name} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="loan-type">Type de prêt</Label>
          <Select value={type} onValueChange={(val) => setType(val as LoanType)}>
            <SelectTrigger id="loan-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOAN_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {LOAN_KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={errors.type} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="loan-amount">Montant emprunté (€)</Label>
          <Input
            id="loan-amount"
            type="text"
            inputMode="decimal"
            placeholder="Ex : 250 000"
            value={borrowedAmount}
            onChange={(e) => setBorrowedAmount(e.target.value)}
            required
          />
          <FieldError message={errors.borrowedAmount} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="loan-duration">
            Durée (mois)
            {numMonths > 0 && (
              <span className="ml-1.5 text-xs text-ink-muted">
                ({durationYears} an{numMonths >= 24 ? "s" : ""})
              </span>
            )}
          </Label>
          <Input
            id="loan-duration"
            type="number"
            min="1"
            max="600"
            placeholder="Ex : 180 (15 ans), 240 (20 ans)"
            value={durationMonths}
            onChange={(e) => setDurationMonths(e.target.value)}
            required
          />
          <FieldError message={errors.durationMonths} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="loan-start-date">Date de première échéance</Label>
          <Input
            id="loan-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
          <FieldError message={errors.startDate} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="loan-interest-rate">Taux d&apos;intérêt annuel (%)</Label>
          <Input
            id="loan-interest-rate"
            type="text"
            inputMode="decimal"
            placeholder="Ex : 3.5"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            required
          />
          <FieldError message={errors.interestRate} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="loan-insurance-rate">
            Taux d&apos;assurance annuel (%)
            <span className="ml-1 text-xs text-ink-faint">(optionnel)</span>
          </Label>
          <Input
            id="loan-insurance-rate"
            type="text"
            inputMode="decimal"
            placeholder="Ex : 0.36"
            value={insuranceRate}
            onChange={(e) => setInsuranceRate(e.target.value)}
          />
          <FieldError message={errors.insuranceRate} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="loan-down-payment">
            Apport personnel (€)
            <span className="ml-1 text-xs text-ink-faint">(optionnel)</span>
          </Label>
          <Input
            id="loan-down-payment"
            type="text"
            inputMode="decimal"
            placeholder="Ex : 20 000"
            value={downPayment}
            onChange={(e) => setDownPayment(e.target.value)}
          />
          <FieldError message={errors.downPayment} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="loan-fees">
            Frais de dossier / garantie (€)
            <span className="ml-1 text-xs text-ink-faint">(optionnel)</span>
          </Label>
          <Input
            id="loan-fees"
            type="text"
            inputMode="decimal"
            placeholder="Ex : 1 500"
            value={initialFees}
            onChange={(e) => setInitialFees(e.target.value)}
          />
          <FieldError message={errors.initialFees} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="loan-custom-monthly">
            Mensualité personnalisée (€/mois)
            <span className="ml-1 text-xs text-ink-faint">
              (optionnel, calculée automatiquement si vide)
            </span>
          </Label>
          <Input
            id="loan-custom-monthly"
            type="text"
            inputMode="decimal"
            placeholder={
              estimatedTotal > 0
                ? `Calculée : ${estimatedTotal.toFixed(2)} €`
                : "Ex : 616.19"
            }
            value={customMonthlyPayment}
            onChange={(e) => setCustomMonthlyPayment(e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="loan-current-balance">
            Capital restant dû actuel (€)
            <span className="ml-1 text-xs text-ink-faint">
              (optionnel, calibré sur votre banque — calculé si vide)
            </span>
          </Label>
          <Input
            id="loan-current-balance"
            type="text"
            inputMode="decimal"
            placeholder="Laisser vide pour calcul automatique selon l&apos;échéancier"
            value={currentBalance}
            onChange={(e) => setCurrentBalance(e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="loan-group-name">
            Groupe / Projet
            <span className="ml-1 text-xs text-ink-faint">
              (optionnel, ex: &quot;Résidence Principale&quot; pour regrouper prêt immo + PTZ)
            </span>
          </Label>
          <Input
            id="loan-group-name"
            list="loan-group-suggestions"
            placeholder="Ex : Résidence Principale, Investissement Locatif..."
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          {availableGroupNames.length > 0 && (
            <datalist id="loan-group-suggestions">
              {availableGroupNames.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          )}
        </div>

        {accounts.length > 0 && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="loan-account">
              Compte / Actif associé
              <span className="ml-1 text-xs text-ink-faint">(optionnel)</span>
            </Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="loan-account">
                <SelectValue placeholder="Aucun compte associé" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun compte associé</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="loan-notes">
            Notes / Références
            <span className="ml-1 text-xs text-ink-faint">(optionnel)</span>
          </Label>
          <Textarea
            id="loan-notes"
            placeholder="Numéro de contrat, organisme prêteur, conditions particulières..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      {/* Aperçu dynamique de la mensualité */}
      <div className="rounded-lg border border-hairline bg-canvas/60 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-muted">Mensualité estimée :</span>
          <span className="tnum font-semibold text-ink">
            <Montant>{formatCurrency(estimatedTotal)}</Montant>
            <span className="text-xs font-normal text-ink-muted"> /mois</span>
          </span>
        </div>
        {numInsurance > 0 && (
          <div className="mt-1 flex justify-between text-xs text-ink-faint">
            <span>
              dont capital & intérêts : {formatCurrency(estimatedBase)}
            </span>
            <span>assurance : {formatCurrency(estimatedInsurance)}</span>
          </div>
        )}
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Annuler
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Enregistrement..."
            : initial?.id
              ? "Enregistrer les modifications"
              : "Créer l&apos;emprunt"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function LoanDialog({
  initial,
  accounts = [],
  availableGroupNames = [],
  trigger,
  open: openProp,
  onOpenChange,
  onSaved,
}: LoanDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {initial?.id ? "Modifier l'emprunt" : "Ajouter un emprunt"}
          </DialogTitle>
          <DialogDescription>
            {initial?.id
              ? "Modifiez les paramètres du prêt pour actualiser son échéancier."
              : "Renseignez les caractéristiques de votre prêt (immobilier, conso, PTZ...)"}
          </DialogDescription>
        </DialogHeader>

        {open && (
          <LoanForm
            initial={initial}
            accounts={accounts}
            availableGroupNames={availableGroupNames}
            onDone={() => setOpen(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
