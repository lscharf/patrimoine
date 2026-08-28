"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CreditCard,
  Info,
  Trash2,
  Wallet,
} from "lucide-react";
import { AmortizationChart } from "@/components/chart/amortization-chart";
import { MonthlyBreakdown } from "@/components/chart/monthly-breakdown";
import { DeleteConfirm } from "@/components/forms/delete-confirm";
import { AmortizationTable } from "@/components/loans/amortization-table";
import { Montant } from "@/components/privacy/amount";
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SimpleTooltip,

  Textarea,
} from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { deleteLoan, updateLoan } from "@/server/actions";
import { LOAN_KIND_LABELS, LOAN_KINDS } from "@/server/actions/schemas";
import type { LoanDetail, LoanType } from "@/server/loans/types";

interface LoanViewProps {
  loan: LoanDetail;
  accounts: Array<{ id: number; name: string }>;
}

export function LoanView({ loan, accounts }: LoanViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<
    "apercu" | "analyse" | "parametres"
  >("apercu");
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [isSavingParams, setIsSavingParams] = React.useState(false);
  // Formulaire d'édition dans l'onglet Paramètres
  const [name, setName] = React.useState(loan.name);
  const [type, setType] = React.useState<LoanType>(loan.type);
  const [borrowedAmount, setBorrowedAmount] = React.useState(String(loan.borrowedAmount));
  const [downPayment, setDownPayment] = React.useState(
    loan.downPayment ? String(loan.downPayment) : "",
  );
  const [initialFees, setInitialFees] = React.useState(
    loan.initialFees ? String(loan.initialFees) : "",
  );
  const [interestRate, setInterestRate] = React.useState(String(loan.interestRate));
  const [insuranceRate, setInsuranceRate] = React.useState(
    loan.insuranceRate ? String(loan.insuranceRate) : "",
  );
  const [durationMonths, setDurationMonths] = React.useState(String(loan.durationMonths));
  const [startDate, setStartDate] = React.useState(loan.startDate);
  const [customMonthlyPayment, setCustomMonthlyPayment] = React.useState(
    loan.customMonthlyPayment ? String(loan.customMonthlyPayment) : "",
  );
  const [currentBalance, setCurrentBalance] = React.useState(
    loan.currentBalance != null ? String(loan.currentBalance) : "",
  );
  const [accountId, setAccountId] = React.useState<string>(
    loan.accountId ? String(loan.accountId) : "none",
  );
  const [groupName, setGroupName] = React.useState(loan.groupName ?? "");
  const [notes, setNotes] = React.useState(loan.notes ?? "");

  const endDateFormatted = loan.endDate
    ? new Date(loan.endDate).toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      })
    : "—";


  const handleSaveParams = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingParams(true);

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

    const res = await updateLoan(loan.id, payload);
    setIsSavingParams(false);

    if (res.ok) {
      toast.success("Paramètres enregistrés");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête : retour + Titre + Onglets de navigation Finary */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/emprunts"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-hairline bg-surface text-ink-muted transition-colors hover:bg-surface-elevated hover:text-ink"
            aria-label="Retour aux emprunts"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>

          <div className="flex items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <CreditCard className="size-4" aria-hidden />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-ink sm:text-xl">
                  {loan.name}
                </h1>
                <Badge variant="neutral" className="text-[11px]">
                  {LOAN_KIND_LABELS[loan.type] ?? loan.type}
                </Badge>
              </div>
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
      {/* ONGLET 1 : APERÇU (Screenshot 2)                                          */}
      {/* ========================================================================= */}
      {activeTab === "apercu" && (
        <div className="space-y-6">
          <section className="rounded-card border border-hairline bg-surface p-5 sm:p-6">
            {/* Grand chiffre principal + sous-titre de progression */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                Capital restant dû
              </p>
              <p className="tnum mt-2 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
                <Montant>{formatCurrency(loan.currentRemainingCapital)}</Montant>
              </p>

              <div className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
                <span>Vous avez remboursé</span>
                <span className="inline-flex items-center gap-1 font-semibold text-accent">
                  <span className="size-2 rounded-full bg-accent" />
                  {loan.reimbursedPct.toFixed(2).replace(".", ",")}%
                </span>
                <span>de votre prêt qui se termine en {endDateFormatted}</span>
              </div>
            </div>

            {/* Graphique de la courbe d'amortissement */}
            <div className="mt-8 border-t border-hairline pt-6">
              <div className="h-[260px] sm:h-[320px]">
                <AmortizationChart
                  points={loan.chartPoints}
                  initialAmount={loan.borrowedAmount}
                />
              </div>
            </div>

            {/* 5 Cartes / Métriques de synthèse en bas */}
            <div className="mt-8 grid grid-cols-2 gap-3 border-t border-hairline pt-6 sm:grid-cols-5">
              <div className="rounded-lg bg-surface-muted/40 p-3">
                <p className="text-[11px] font-medium text-ink-faint">
                  Taux d&apos;intérêt
                </p>
                <p className="tnum mt-1 text-base font-semibold text-ink">
                  {loan.interestRate}%
                </p>
              </div>

              <div className="rounded-lg bg-surface-muted/40 p-3">
                <p className="text-[11px] font-medium text-ink-faint">
                  Mensualité
                </p>
                <p className="tnum mt-1 text-base font-semibold text-ink">
                  <Montant>{formatCurrency(loan.monthlyPayment)}</Montant>
                </p>
              </div>

              <div className="rounded-lg bg-surface-muted/40 p-3">
                <div className="flex items-center gap-1">
                  <p className="text-[11px] font-medium text-ink-faint">
                    Coût total
                  </p>
                  <SimpleTooltip label="Total des mensualités prévues + frais initiaux">
                    <Info className="size-3 text-ink-faint cursor-help" />
                  </SimpleTooltip>
                </div>
                <p className="tnum mt-1 text-base font-semibold text-ink">
                  <Montant>{formatCurrency(loan.totalCost)}</Montant>
                </p>
              </div>

              <div className="rounded-lg bg-surface-muted/40 p-3">
                <p className="text-[11px] font-medium text-ink-faint">
                  Remboursé
                </p>
                <p className="tnum mt-1 text-base font-semibold text-positive">
                  <Montant>{formatCurrency(loan.totalPaid)}</Montant>
                </p>
              </div>

              <div className="col-span-2 rounded-lg bg-surface-muted/40 p-3 sm:col-span-1">
                <div className="flex items-center gap-1">
                  <p className="text-[11px] font-medium text-ink-faint">
                    Capital restant dû
                  </p>
                  <SimpleTooltip label="Capital restant à amortir hors intérêts et assurances futurs">
                    <Info className="size-3 text-ink-faint cursor-help" />
                  </SimpleTooltip>
                </div>
                <p className="tnum mt-1 text-base font-semibold text-ink">
                  <Montant>{formatCurrency(loan.currentRemainingCapital)}</Montant>
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 2 : ANALYSE (Screenshot 3)                                         */}
      {/* ========================================================================= */}
      {activeTab === "analyse" && (
        <div className="space-y-6">
          {/* Grille 2 colonnes comme sur Finary */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Carte Mensualité avec Donut & répartition */}
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">Mensualité</h3>
                <span className="text-xs text-ink-muted">
                  {loan.reimbursedPct.toFixed(2).replace(".", ",")}% remboursé
                </span>
              </div>
              <div className="mt-4">
                <MonthlyBreakdown
                  monthlyPayment={loan.monthlyPayment}
                  monthlyPrincipal={loan.monthlyPrincipal}
                  monthlyInterest={loan.monthlyInterest}
                  monthlyInsurance={loan.monthlyInsurance}
                  reimbursedPct={loan.reimbursedPct}
                />
              </div>
            </Card>

            {/* Carte Échéances passées */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-ink">Échéances</h3>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-ink-muted">Mensualités payées</p>
                  <p className="tnum mt-1 text-2xl font-bold text-ink">
                    {loan.paidInstallments}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-muted">Mensualités restantes</p>
                  <p className="tnum mt-1 text-2xl font-bold text-ink">
                    {loan.remainingInstallments}
                  </p>
                </div>
              </div>

              <div className="mt-6 border-t border-hairline pt-4">
                <p className="text-xs text-ink-muted">Dernière échéance</p>
                <p className="mt-1 font-medium text-ink">
                  {loan.endDate
                    ? new Date(loan.endDate).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "—"}
                </p>
              </div>
            </Card>

            {/* Carte Coût total du prêt */}
            <Card className="p-5">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-ink">Coût total du prêt</h3>
                <span className="tnum text-lg font-bold text-ink">
                  <Montant>{formatCurrency(loan.totalCost)}</Montant>
                </span>
              </div>
              <div className="mt-4 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-muted">Capital</span>
                  <span className="tnum font-medium text-ink">
                    <Montant>{formatCurrency(loan.borrowedAmount)}</Montant>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Intérêts & assurance</span>
                  <span className="tnum font-medium text-ink">
                    <Montant>{formatCurrency(loan.totalInterest + loan.totalInsurance)}</Montant>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Frais</span>
                  <span className="tnum font-medium text-ink">
                    {loan.initialFees > 0 ? (
                      <Montant>{formatCurrency(loan.initialFees)}</Montant>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              </div>
            </Card>

            {/* Carte Total remboursé */}
            <Card className="p-5">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-ink">Total remboursé</h3>
                <span className="tnum text-lg font-bold text-positive">
                  <Montant>{formatCurrency(loan.totalPaid)}</Montant>
                </span>
              </div>
              <div className="mt-4 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-muted">Capital</span>
                  <span className="tnum font-medium text-ink">
                    <Montant>{formatCurrency(loan.paidCapital)}</Montant>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Intérêt</span>
                  <span className="tnum font-medium text-ink">
                    <Montant>{formatCurrency(loan.paidInterest)}</Montant>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Assurance</span>
                  <span className="tnum font-medium text-ink">
                    {loan.paidInsurance > 0 ? (
                      <Montant>{formatCurrency(loan.paidInsurance)}</Montant>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              </div>
            </Card>

            {/* Carte Capital restant dû */}
            <Card className="p-5">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-ink">Capital restant dû</h3>
                <span className="tnum text-lg font-bold text-ink">
                  <Montant>{formatCurrency(loan.currentRemainingCapital)}</Montant>
                </span>
              </div>
              <div className="mt-4 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-muted">Encours restant dû</span>
                  <span className="tnum font-medium text-ink">
                    <Montant>{formatCurrency(loan.totalOutstandingDue)}</Montant>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Encours restant dû (%)</span>
                  <span className="tnum font-medium text-ink">
                    {loan.remainingDuePct.toFixed(0)}%
                  </span>
                </div>
              </div>
            </Card>

            {/* Carte Actifs liés */}
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">Actifs liés</h3>
              </div>
              <div className="mt-4 flex flex-col justify-between space-y-3">
                {loan.linkedAccountName ? (
                  <div className="flex items-center gap-2 text-sm text-ink">
                    <Wallet className="size-4 text-accent" />
                    <span>{loan.linkedAccountName}</span>
                  </div>
                ) : (
                  <p className="text-xs text-ink-faint">
                    Aucun compte associé à cet emprunt.
                  </p>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("parametres")}
                  className="w-full text-xs"
                >
                  {loan.linkedAccountName ? "Modifier l'actif lié" : "+ Lier un actif"}
                </Button>
              </div>
            </Card>
          </div>

          {/* Tableau d'amortissement complet mois par mois */}
          <Card className="p-5">
            <AmortizationTable
              schedule={loan.schedule}
              paidInstallmentsCount={loan.paidInstallments}
            />
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 3 : PARAMÈTRES (Screenshots 4, 5, 6)                               */}
      {/* ========================================================================= */}
      {activeTab === "parametres" && (
        <div className="rounded-card border border-hairline bg-surface p-5 sm:p-6">
          <form onSubmit={handleSaveParams} className="space-y-6 max-w-2xl">
            {/* Section 1 : Informations */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-muted border-b border-hairline pb-2">
                Informations
              </h3>
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

                <div className="space-y-1.5">
                  <Label htmlFor="param-type">Type de prêt</Label>
                  <Select value={type} onValueChange={(val) => setType(val as LoanType)}>
                    <SelectTrigger id="param-type">
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
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="param-amount">Montant total (EUR)</Label>
                  <Input
                    id="param-amount"
                    type="text"
                    inputMode="decimal"
                    value={borrowedAmount}
                    onChange={(e) => setBorrowedAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="param-downpayment">
                    Apport <span className="text-xs text-ink-faint">(Optionnel)</span>
                  </Label>
                  <Input
                    id="param-downpayment"
                    type="text"
                    inputMode="decimal"
                    value={downPayment}
                    onChange={(e) => setDownPayment(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="param-fees">
                    Frais de dossier <span className="text-xs text-ink-faint">(Optionnel)</span>
                  </Label>
                  <Input
                    id="param-fees"
                    type="text"
                    inputMode="decimal"
                    value={initialFees}
                    onChange={(e) => setInitialFees(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="param-group">
                    Groupe / Projet <span className="text-xs text-ink-faint">(Optionnel, ex: Résidence Principale)</span>
                  </Label>
                  <Input
                    id="param-group"
                    placeholder="Ex : Résidence Principale, Investissement Locatif..."
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Section 2 : Caractéristiques */}
            <div className="space-y-4 pt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-muted border-b border-hairline pb-2">
                Caractéristiques
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="param-rate">Taux d&apos;intérêt (%)</Label>
                  <Input
                    id="param-rate"
                    type="text"
                    inputMode="decimal"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="param-insurance">
                    Taux d&apos;assurance (%) <span className="text-xs text-ink-faint">(Optionnel)</span>
                  </Label>
                  <Input
                    id="param-insurance"
                    type="text"
                    inputMode="decimal"
                    value={insuranceRate}
                    onChange={(e) => setInsuranceRate(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="param-monthly">
                    Mensualité personnalisée (€/mois){" "}
                    <span className="text-xs text-ink-faint">(facultatif, calculée automatiquement si vide)</span>
                  </Label>
                  <Input
                    id="param-monthly"
                    type="text"
                    inputMode="decimal"
                    placeholder={`Calculée : ${loan.monthlyPayment} €`}
                    value={customMonthlyPayment}
                    onChange={(e) => setCustomMonthlyPayment(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="param-balance">
                    Capital restant dû actuel (€){" "}
                    <span className="text-xs text-ink-faint">
                      (optionnel, calibré sur votre banque — calculé si vide)
                    </span>
                  </Label>
                  <Input
                    id="param-balance"
                    type="text"
                    inputMode="decimal"
                    placeholder="Laisser vide pour calcul automatique selon l&apos;échéancier"
                    value={currentBalance}
                    onChange={(e) => setCurrentBalance(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Section 3 : Échéancier */}
            <div className="space-y-4 pt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-muted border-b border-hairline pb-2">
                Échéancier
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="param-duration">Durée (mois)</Label>
                  <Input
                    id="param-duration"
                    type="number"
                    min="1"
                    max="600"
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="param-start">Date de début</Label>
                  <Input
                    id="param-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Date de fin calculée</Label>
                  <p className="text-sm font-medium text-ink-muted bg-surface-muted/30 px-3 py-2 rounded-md border border-hairline">
                    {endDateFormatted}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 4 : Actifs liés & Notes */}
            <div className="space-y-4 pt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-muted border-b border-hairline pb-2">
                Actifs liés & Notes
              </h3>
              <div className="space-y-4">
                {accounts.length > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="param-account">Compte associé</Label>
                    <Select value={accountId} onValueChange={setAccountId}>
                      <SelectTrigger id="param-account">
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

                <div className="space-y-1.5">
                  <Label htmlFor="param-notes">Notes & observations</Label>
                  <Textarea
                    id="param-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-hairline">
              <Button
                type="button"
                variant="danger"
                onClick={() => setDeleteOpen(true)}
                className="gap-1.5"
              >
                <Trash2 className="size-4" />
                <span>Supprimer le prêt</span>
              </Button>

              <Button type="submit" disabled={isSavingParams}>
                {isSavingParams ? "Enregistrement..." : "Enregistrer les modifications"}
              </Button>
            </div>
          </form>

          {/* Dialogue de confirmation de suppression */}
          <DeleteConfirm
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title={`Supprimer ${loan.name} ?`}
            description="Cette action est irréversible. L'échéancier et l'historique d'amortissement de cet emprunt seront définitivement supprimés."
            onConfirm={() => deleteLoan(loan.id)}
            redirectTo="/emprunts"
          />
        </div>
      )}
    </div>
  );
}
