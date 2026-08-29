import type { RealEstateProperty } from "@/db/schema";
import type { LoanSummary } from "@/server/loans/types";
import type {
  LinkedLoanInfo,
  PropertyCategory,
  PropertySummary,
  PropertyType,
  RealEstateSummary,
} from "./types";

export function computePropertySummary(
  property: RealEstateProperty,
  allLoans: LoanSummary[] = [],
): PropertySummary {
  const rawEstimatedValue = property.estimatedValue ?? 0;
  const rawPurchasePrice = property.purchasePrice ?? 0;
  const rawNotaryFees = property.notaryFees ?? 0;
  const rawRenovationCosts = property.renovationCosts ?? 0;

  const totalAcquisitionCost =
    rawPurchasePrice + rawNotaryFees + rawRenovationCosts;
  const unrealizedGain = rawEstimatedValue - totalAcquisitionCost;
  const unrealizedGainPct =
    totalAcquisitionCost > 0
      ? (unrealizedGain / totalAcquisitionCost) * 100
      : null;

  const surface = property.surface ?? 0;
  const pricePerSquareMeter =
    surface > 0 ? Math.round(rawEstimatedValue / surface) : null;

  // Filtrer les emprunts rattachés à ce bien
  const matchedLoans = allLoans.filter((l) => {
    // Si l'emprunt porte explicitement propertyId
    // @ts-expect-error propertyId can exist on loan
    if (l.propertyId === property.id) return true;
    // Ou si le groupName correspond au nom du bien
    if (
      l.groupName &&
      property.name &&
      l.groupName.toLowerCase().trim() === property.name.toLowerCase().trim()
    ) {
      return true;
    }
    return false;
  });

  const linkedLoans: LinkedLoanInfo[] = matchedLoans.map((l) => ({
    id: l.id,
    name: l.name,
    type: l.type,
    borrowedAmount: l.borrowedAmount,
    remainingCapital: l.currentRemainingCapital,
    monthlyPayment: l.monthlyPayment,
    interestRate: l.interestRate,
    endDate: l.endDate,
  }));

  const totalRemainingDebt = linkedLoans.reduce(
    (sum, l) => sum + l.remainingCapital,
    0,
  );
  const totalMonthlyPayments = linkedLoans.reduce(
    (sum, l) => sum + l.monthlyPayment,
    0,
  );

  const netEquity = rawEstimatedValue - totalRemainingDebt;
  const loanToValuePct =
    rawEstimatedValue > 0
      ? (totalRemainingDebt / rawEstimatedValue) * 100
      : null;

  const monthlyRent = property.monthlyRent ?? 0;
  const annualRent = monthlyRent * 12;
  const condoFees = property.condoFees ?? 0;
  const propertyTax = property.propertyTax ?? 0;

  const grossYieldPct =
    rawEstimatedValue > 0 && annualRent > 0
      ? (annualRent / rawEstimatedValue) * 100
      : null;

  const netIncome = annualRent - condoFees * 12 - propertyTax;
  const netYieldPct =
    totalAcquisitionCost > 0 && annualRent > 0
      ? (netIncome / totalAcquisitionCost) * 100
      : null;

  const monthlyCashflow =
    monthlyRent > 0
      ? monthlyRent - condoFees - propertyTax / 12 - totalMonthlyPayments
      : null;

  return {
    id: property.id,
    userId: property.userId,
    name: property.name,
    description: property.description,
    type: property.type as PropertyType,
    category: property.category as PropertyCategory,
    address: property.address,
    city: property.city,
    zipcode: property.zipcode,

    surface,
    purchasePrice: rawPurchasePrice,
    purchaseDate: property.purchaseDate,
    notaryFees: rawNotaryFees,
    renovationCosts: rawRenovationCosts,
    estimatedValue: rawEstimatedValue,
    totalAcquisitionCost,

    monthlyRent,
    condoFees,
    propertyTax,
    annualRent,
    grossYieldPct,
    netYieldPct,
    monthlyCashflow,

    unrealizedGain,
    unrealizedGainPct,
    pricePerSquareMeter,

    linkedLoans,
    totalRemainingDebt,
    netEquity,
    loanToValuePct,

    floor: property.floor,
    totalFloors: property.totalFloors,
    rooms: property.rooms,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    garages: property.garages,
    parkingSpots: property.parkingSpots,
    gardenSurface: property.gardenSurface,
    terraceSurface: property.terraceSurface,
    hasElevator: Boolean(property.hasElevator),
    isNew: Boolean(property.isNew),
    isFurnished: Boolean(property.isFurnished),

    kitchenQuality: property.kitchenQuality,
    kitchenCondition: property.kitchenCondition,
    bathroomQuality: property.bathroomQuality,
    bathroomCondition: property.bathroomCondition,
    flooringQuality: property.flooringQuality,
    flooringCondition: property.flooringCondition,
    windowsQuality: property.windowsQuality,
    windowsCondition: property.windowsCondition,
    generalQuality: property.generalQuality,
    generalCondition: property.generalCondition,

    ownershipPct: property.ownershipPct ?? 100,
    coOwners: property.coOwners,

    createdAt: property.createdAt,
    updatedAt: property.updatedAt,
  };
}

export function computeRealEstateSummary(
  properties: RealEstateProperty[],
  allLoans: LoanSummary[] = [],
): RealEstateSummary {
  const propertySummaries = properties.map((p) =>
    computePropertySummary(p, allLoans),
  );

  let totalGrossValue = 0;
  let totalRemainingDebt = 0;
  let totalAcquisitionCost = 0;
  let totalSurface = 0;
  let totalMonthlyRent = 0;
  let totalMonthlyCashflow = 0;
  const countedLoanIds = new Set<number>();

  for (const p of propertySummaries) {
    const factor = p.ownershipPct / 100;
    totalGrossValue += p.estimatedValue * factor;
    totalAcquisitionCost += p.totalAcquisitionCost * factor;
    totalSurface += p.surface * factor;
    totalMonthlyRent += p.monthlyRent * factor;
    if (p.monthlyCashflow != null) {
      totalMonthlyCashflow += p.monthlyCashflow * factor;
    }
    for (const loan of p.linkedLoans) {
      if (!countedLoanIds.has(loan.id)) {
        countedLoanIds.add(loan.id);
        totalRemainingDebt += loan.remainingCapital;
      }
    }
  }

  const totalNetEquity = totalGrossValue - totalRemainingDebt;
  const totalUnrealizedGain = totalGrossValue - totalAcquisitionCost;
  const totalUnrealizedGainPct =
    totalAcquisitionCost > 0
      ? (totalUnrealizedGain / totalAcquisitionCost) * 100
      : null;
  const averagePricePerM2 =
    totalSurface > 0 ? Math.round(totalGrossValue / totalSurface) : null;

  return {
    properties: propertySummaries,
    propertiesCount: propertySummaries.length,
    totalGrossValue,
    totalRemainingDebt,
    totalNetEquity,
    totalAcquisitionCost,
    totalUnrealizedGain,
    totalUnrealizedGainPct,
    totalSurface,
    averagePricePerM2,
    totalMonthlyRent,
    totalMonthlyCashflow,
    activeLoansCount: countedLoanIds.size,
  };
}
