import type { Loan } from "@/db/schema";
import type { SeriesPoint } from "@/server/portfolio/types";
import type {
  AmortizationScheduleRow,
  LiabilitiesSummary,
  LoanDetail,
  LoanType,
} from "./types";

/** Ajoute `monthsToAdd` mois à une date ISO YYYY-MM-DD en préservant le jour (avec clamp sur fin de mois). */
export function addMonthsToIsoDate(isoDate: string, monthsToAdd: number): string {
  const [yStr, mStr, dStr] = isoDate.split("-");
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10) - 1;
  const day = parseInt(dStr, 10);

  const targetDate = new Date(Date.UTC(year, month + monthsToAdd, 1));
  const targetYear = targetDate.getUTCFullYear();
  const targetMonth = targetDate.getUTCMonth();

  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, daysInTargetMonth);

  const finalDate = new Date(Date.UTC(targetYear, targetMonth, clampedDay));
  return finalDate.toISOString().slice(0, 10);
}

/** Calcule la mensualité théorique hors assurance d'un prêt amortissable. */
export function calculateBaseMonthlyPayment(
  principal: number,
  annualInterestRate: number,
  durationMonths: number,
  type: LoanType = "AMORTIZING",
): number {
  if (durationMonths <= 0 || principal <= 0) return 0;
  if (type === "IN_FINE") {
    const monthlyRate = annualInterestRate / 100 / 12;
    return principal * monthlyRate;
  }
  if (type === "PTZ" || annualInterestRate <= 0) {
    return principal / durationMonths;
  }

  const monthlyRate = annualInterestRate / 100 / 12;
  const factor = Math.pow(1 + monthlyRate, durationMonths);
  const monthly = (principal * monthlyRate * factor) / (factor - 1);
  return monthly;
}

/** Calcule la mensualité d'assurance mensuelle basée sur le capital initial. */
export function calculateMonthlyInsurance(
  principal: number,
  annualInsuranceRate: number,
): number {
  if (annualInsuranceRate <= 0 || principal <= 0) return 0;
  return (principal * (annualInsuranceRate / 100)) / 12;
}

/** Génère le tableau d'amortissement complet mois par mois. */
export function generateAmortizationSchedule(loan: {
  borrowedAmount: number;
  interestRate: number;
  insuranceRate: number;
  durationMonths: number;
  startDate: string;
  type?: string;
  customMonthlyPayment?: number | null;
}): AmortizationScheduleRow[] {
  const schedule: AmortizationScheduleRow[] = [];
  const type = (loan.type as LoanType) || "AMORTIZING";
  const principal = loan.borrowedAmount;
  const duration = Math.max(1, loan.durationMonths);
  const monthlyInterestRate = (loan.interestRate || 0) / 100 / 12;
  const monthlyInsurance = calculateMonthlyInsurance(principal, loan.insuranceRate || 0);

  let calculatedBaseMonthly = calculateBaseMonthlyPayment(
    principal,
    loan.interestRate || 0,
    duration,
    type,
  );

  // Si une mensualité personnalisée est fournie et > assurance, on adapte la part de base
  if (
    loan.customMonthlyPayment &&
    loan.customMonthlyPayment > monthlyInsurance &&
    type === "AMORTIZING"
  ) {
    calculatedBaseMonthly = loan.customMonthlyPayment - monthlyInsurance;
  }

  let remainingPrincipal = principal;

  for (let m = 1; m <= duration; m++) {
    const date = addMonthsToIsoDate(loan.startDate, m - 1);
    let interest = 0;
    let principalPayment = 0;

    if (type === "IN_FINE") {
      interest = remainingPrincipal * monthlyInterestRate;
      principalPayment = m === duration ? remainingPrincipal : 0;
    } else if (type === "PTZ" || loan.interestRate <= 0) {
      interest = 0;
      principalPayment = m === duration ? remainingPrincipal : principal / duration;
    } else {
      // Amortissable standard
      interest = remainingPrincipal * monthlyInterestRate;
      if (m === duration) {
        principalPayment = remainingPrincipal;
      } else {
        principalPayment = Math.min(
          remainingPrincipal,
          Math.max(0, calculatedBaseMonthly - interest),
        );
      }
    }

    remainingPrincipal = Math.max(0, remainingPrincipal - principalPayment);
    const totalPayment = principalPayment + interest + monthlyInsurance;

    schedule.push({
      installmentNumber: m,
      date,
      principalPayment: Number(principalPayment.toFixed(2)),
      interestPayment: Number(interest.toFixed(2)),
      insurancePayment: Number(monthlyInsurance.toFixed(2)),
      totalPayment: Number(totalPayment.toFixed(2)),
      remainingPrincipal: Number(remainingPrincipal.toFixed(2)),
    });
  }

  return schedule;
}

/** Calcule le détail et les métriques d'un emprunt à la date de référence (par défaut aujourd'hui). */
export function computeLoanDetail(
  loan: Loan,
  options?: {
    referenceDate?: string;
    linkedAccountName?: string | null;
    linkedHoldingLabel?: string | null;
  },
): LoanDetail {
  const referenceDate =
    options?.referenceDate ?? new Date().toISOString().slice(0, 10);

  const schedule = generateAmortizationSchedule(loan);
  const type = (loan.type as LoanType) || "AMORTIZING";
  const endDate =
    schedule.length > 0
      ? schedule[schedule.length - 1].date
      : addMonthsToIsoDate(loan.startDate, loan.durationMonths);

  // Déterminer les échéances passées et futures
  const pastInstallments = schedule.filter((row) => row.date <= referenceDate);
  const paidCount = pastInstallments.length;
  const remainingCount = Math.max(0, schedule.length - paidCount);

  const lastPayment = pastInstallments.length > 0 ? pastInstallments[pastInstallments.length - 1] : null;
  const nextPayment = paidCount < schedule.length ? schedule[paidCount] : null;

  // Capital restant dû actuel
  let currentRemainingCapital = loan.borrowedAmount;
  if (lastPayment) {
    currentRemainingCapital = lastPayment.remainingPrincipal;
  }
  if (paidCount >= schedule.length) {
    currentRemainingCapital = 0;
  }

  // Cumuls payés
  let paidCapital = 0;
  let paidInterest = 0;
  let paidInsurance = 0;
  for (const row of pastInstallments) {
    paidCapital += row.principalPayment;
    paidInterest += row.interestPayment;
    paidInsurance += row.insurancePayment;
  }
  const totalPaid = paidCapital + paidInterest + paidInsurance;

  // Totaux sur toute la durée
  let totalInterest = 0;
  let totalInsurance = 0;
  for (const row of schedule) {
    totalInterest += row.interestPayment;
    totalInsurance += row.insurancePayment;
  }
  const totalCost =
    loan.borrowedAmount + totalInterest + totalInsurance + (loan.initialFees || 0);

  // Encours restant dû total (somme des mensualités futures restantes)
  let totalOutstandingDue = 0;
  for (let i = paidCount; i < schedule.length; i++) {
    totalOutstandingDue += schedule[i].totalPayment;
  }

  // Mensualité actuelle (selon la prochaine échéance ou la dernière)
  const currentInstallment = nextPayment ?? lastPayment ?? schedule[0];
  const monthlyPayment = currentInstallment ? currentInstallment.totalPayment : 0;
  const monthlyPrincipal = currentInstallment ? currentInstallment.principalPayment : 0;
  const monthlyInterest = currentInstallment ? currentInstallment.interestPayment : 0;
  const monthlyInsurance = currentInstallment ? currentInstallment.insurancePayment : 0;

  // Pourcentages
  const reimbursedPct = totalCost > 0 ? (totalPaid / totalCost) * 100 : 0;
  const capitalReimbursedPct =
    loan.borrowedAmount > 0 ? (paidCapital / loan.borrowedAmount) * 100 : 0;
  const remainingDuePct =
    loan.borrowedAmount > 0
      ? (currentRemainingCapital / loan.borrowedAmount) * 100
      : 0;

  // Points pour le graphique d'amortissement
  const chartPoints: SeriesPoint[] = [];

  // Point de départ (date de début, capital emprunté initial)
  const startEpoch = new Date(`${loan.startDate}T00:00:00Z`).getTime();
  if (!Number.isNaN(startEpoch)) {
    chartPoints.push({ t: startEpoch, v: loan.borrowedAmount });
  }

  for (const row of schedule) {
    const epoch = new Date(`${row.date}T00:00:00Z`).getTime();
    if (!Number.isNaN(epoch)) {
      chartPoints.push({ t: epoch, v: row.remainingPrincipal });
    }
  }

  return {
    id: loan.id,
    userId: loan.userId,
    name: loan.name,
    type,
    borrowedAmount: loan.borrowedAmount,
    downPayment: loan.downPayment,
    initialFees: loan.initialFees,
    interestRate: loan.interestRate,
    insuranceRate: loan.insuranceRate,
    durationMonths: loan.durationMonths,
    startDate: loan.startDate,
    endDate,
    customMonthlyPayment: loan.customMonthlyPayment,
    notes: loan.notes,
    accountId: loan.accountId,
    holdingId: loan.holdingId,
    linkedAccountName: options?.linkedAccountName ?? null,
    linkedHoldingLabel: options?.linkedHoldingLabel ?? null,

    monthlyPayment: Number(monthlyPayment.toFixed(2)),
    monthlyPrincipal: Number(monthlyPrincipal.toFixed(2)),
    monthlyInterest: Number(monthlyInterest.toFixed(2)),
    monthlyInsurance: Number(monthlyInsurance.toFixed(2)),

    paidInstallments: paidCount,
    remainingInstallments: remainingCount,
    lastPaymentDate: lastPayment ? lastPayment.date : null,
    nextPaymentDate: nextPayment ? nextPayment.date : null,

    currentRemainingCapital: Number(currentRemainingCapital.toFixed(2)),
    totalOutstandingDue: Number(totalOutstandingDue.toFixed(2)),
    remainingDuePct: Number(remainingDuePct.toFixed(2)),

    paidCapital: Number(paidCapital.toFixed(2)),
    paidInterest: Number(paidInterest.toFixed(2)),
    paidInsurance: Number(paidInsurance.toFixed(2)),
    totalPaid: Number(totalPaid.toFixed(2)),

    totalInterest: Number(totalInterest.toFixed(2)),
    totalInsurance: Number(totalInsurance.toFixed(2)),
    totalCost: Number(totalCost.toFixed(2)),

    reimbursedPct: Number(reimbursedPct.toFixed(2)),
    capitalReimbursedPct: Number(capitalReimbursedPct.toFixed(2)),

    schedule,
    chartPoints,
  };
}

/** Calcule la synthèse globale des emprunts / passif pour un ensemble de prêts */
export function computeLiabilitiesSummary(
  loans: Loan[],
  linkedMeta?: {
    accountsMap?: Map<number, string>;
    holdingsMap?: Map<number, string>;
  },
  referenceDate?: string,
): LiabilitiesSummary {
  const details = loans.map((l) =>
    computeLoanDetail(l, {
      referenceDate,
      linkedAccountName: l.accountId ? linkedMeta?.accountsMap?.get(l.accountId) : undefined,
      linkedHoldingLabel: l.holdingId ? linkedMeta?.holdingsMap?.get(l.holdingId) : undefined,
    }),
  );

  let totalRemainingCapital = 0;
  let totalBorrowedAmount = 0;
  let totalMonthlyPayment = 0;
  let totalPaidAmount = 0;
  let totalCost = 0;
  let weightedRateSum = 0;
  let activeLoansCount = 0;

  for (const item of details) {
    totalRemainingCapital += item.currentRemainingCapital;
    totalBorrowedAmount += item.borrowedAmount;
    totalPaidAmount += item.totalPaid;
    totalCost += item.totalCost;

    if (item.currentRemainingCapital > 0) {
      totalMonthlyPayment += item.monthlyPayment;
      weightedRateSum += item.interestRate * item.currentRemainingCapital;
      activeLoansCount += 1;
    }
  }

  const averageInterestRate =
    totalRemainingCapital > 0
      ? Number((weightedRateSum / totalRemainingCapital).toFixed(2))
      : 0;

  // Calcul d'une courbe globale consolidée de passif dans le temps
  const dateMap = new Map<string, number>();
  for (const d of details) {
    for (const pt of d.schedule) {
      const existing = dateMap.get(pt.date) ?? 0;
      dateMap.set(pt.date, existing + pt.remainingPrincipal);
    }
  }

  // Trier par date
  const sortedDates = Array.from(dateMap.keys()).sort();
  const chartPoints: SeriesPoint[] = [];

  const todayIso = referenceDate ?? new Date().toISOString().slice(0, 10);
  const todayEpoch = new Date(`${todayIso}T00:00:00Z`).getTime();
  if (!Number.isNaN(todayEpoch)) {
    chartPoints.push({ t: todayEpoch, v: Number(totalRemainingCapital.toFixed(2)) });
  }

  for (const date of sortedDates) {
    const epoch = new Date(`${date}T00:00:00Z`).getTime();
    if (!Number.isNaN(epoch) && epoch > todayEpoch) {
      chartPoints.push({ t: epoch, v: Number((dateMap.get(date) ?? 0).toFixed(2)) });
    }
  }

  return {
    totalRemainingCapital: Number(totalRemainingCapital.toFixed(2)),
    totalBorrowedAmount: Number(totalBorrowedAmount.toFixed(2)),
    totalMonthlyPayment: Number(totalMonthlyPayment.toFixed(2)),
    totalPaidAmount: Number(totalPaidAmount.toFixed(2)),
    totalCost: Number(totalCost.toFixed(2)),
    averageInterestRate,
    loansCount: loans.length,
    activeLoansCount,
    loans: details,
    chartPoints,
  };
}
