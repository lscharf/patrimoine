import type { SeriesPoint } from "@/server/portfolio/types";

export const LOAN_TYPES = [
  "AMORTIZING",
  "IN_FINE",
  "PTZ",
  "OTHER",
] as const;

export type LoanType = (typeof LOAN_TYPES)[number];

export const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  AMORTIZING: "Prêt amortissable (standard)",
  IN_FINE: "Prêt in fine",
  PTZ: "Prêt à taux zéro (PTZ)",
  OTHER: "Autre prêt",
};

/** Une échéance du tableau d'amortissement */
export interface AmortizationScheduleRow {
  installmentNumber: number;
  date: string; // YYYY-MM-DD
  principalPayment: number;
  interestPayment: number;
  insurancePayment: number;
  totalPayment: number;
  remainingPrincipal: number;
}

/** Synthèse et métriques calculées pour un emprunt */
export interface LoanSummary {
  id: number;
  userId: string | null;
  name: string;
  type: LoanType;
  borrowedAmount: number;
  downPayment: number;
  initialFees: number;
  interestRate: number;
  insuranceRate: number;
  durationMonths: number;
  startDate: string;
  endDate: string;
  customMonthlyPayment: number | null;
  currentBalance: number | null;
  groupName: string | null;
  notes: string | null;
  accountId: number | null;
  holdingId: number | null;
  linkedAccountName?: string | null;
  linkedHoldingLabel?: string | null;

  // Métriques courantes calculées (à aujourd'hui)
  monthlyPayment: number; // Mensualité courante
  monthlyPrincipal: number; // Part de capital dans la mensualité courante
  monthlyInterest: number; // Part d'intérêts dans la mensualité courante
  monthlyInsurance: number; // Part d'assurance dans la mensualité courante

  paidInstallments: number; // Nombre de mensualités payées
  remainingInstallments: number; // Nombre de mensualités restantes
  lastPaymentDate: string | null; // Date de la dernière échéance passée
  nextPaymentDate: string | null; // Date de la prochaine échéance

  currentRemainingCapital: number; // Capital restant dû aujourd'hui
  totalOutstandingDue: number; // Encours restant dû total (mensualités restantes totales)
  remainingDuePct: number; // % du capital ou encours restant

  paidCapital: number; // Capital déjà remboursé
  paidInterest: number; // Intérêts déjà payés
  paidInsurance: number; // Assurance déjà payée
  totalPaid: number; // Total remboursé (capital + intérêts + assurance)

  totalInterest: number; // Coût total des intérêts sur toute la durée
  totalInsurance: number; // Coût total de l'assurance sur toute la durée
  totalCost: number; // Coût total du crédit (capital + intérêts + assurance + frais)

  reimbursedPct: number; // % du coût total remboursé (comme sur Finary)
  capitalReimbursedPct: number; // % du capital initial remboursé
}

/** Détail complet d'un emprunt avec son tableau d'amortissement et ses points de courbe */
export interface LoanDetail extends LoanSummary {
  schedule: AmortizationScheduleRow[];
  chartPoints: SeriesPoint[];
}

/** Groupe d'emprunts consolidé (ex: Résidence Principale) */
export interface LoanGroup {
  name: string;
  totalRemainingCapital: number;
  totalBorrowedAmount: number;
  totalMonthlyPayment: number;
  totalPaidAmount: number;
  averageInterestRate: number;
  loansCount: number;
  loans: LoanSummary[];
}

/** Synthèse consolidée de tous les emprunts (passif global) */
export interface LiabilitiesSummary {
  totalRemainingCapital: number; // Total du capital restant dû
  totalBorrowedAmount: number; // Total initial emprunté
  totalMonthlyPayment: number; // Total des mensualités actuelles / mois
  totalPaidAmount: number; // Total déjà remboursé
  totalCost: number; // Coût total de tous les emprunts
  averageInterestRate: number; // Taux d'intérêt moyen pondéré par le capital restant
  loansCount: number; // Nombre total d'emprunts
  activeLoansCount: number; // Nombre d'emprunts encore en cours
  loans: LoanSummary[];
  groups: LoanGroup[]; // Emprunts groupés par projet/groupe
  availableGroupNames: string[]; // Suggestions de groupes existants
  chartPoints: SeriesPoint[]; // Courbe globale d'extinction du passif
}
