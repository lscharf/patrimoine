import type {
  PROPERTY_CATEGORIES,
  PROPERTY_TYPES,
} from "@/server/actions/schemas";

export type PropertyType = (typeof PROPERTY_TYPES)[number];
export type PropertyCategory = (typeof PROPERTY_CATEGORIES)[number];

export interface LinkedLoanInfo {
  id: number;
  name: string;
  type: string;
  borrowedAmount: number;
  remainingCapital: number;
  monthlyPayment: number;
  interestRate: number;
  endDate: string;
}

export interface PropertySummary {
  id: number;
  userId: string | null;
  name: string;
  description: string | null;
  type: PropertyType;
  category: PropertyCategory;
  address: string | null;
  city: string | null;
  zipcode: string | null;

  // Données financières & d'acquisition
  surface: number;
  purchasePrice: number;
  purchaseDate: string | null;
  notaryFees: number;
  renovationCosts: number;
  estimatedValue: number;
  totalAcquisitionCost: number; // purchasePrice + notaryFees + renovationCosts

  // Données locatives & charges
  monthlyRent: number;
  condoFees: number;
  propertyTax: number;
  annualRent: number;
  grossYieldPct: number | null; // (annualRent / estimatedValue) * 100
  netYieldPct: number | null; // ((annualRent - (condoFees * 12) - propertyTax) / totalAcquisitionCost) * 100
  monthlyCashflow: number | null; // monthlyRent - condoFees - (propertyTax / 12) - linkedMonthlyPayments

  // Plus-value & enrichissement
  unrealizedGain: number; // estimatedValue - totalAcquisitionCost
  unrealizedGainPct: number | null; // (unrealizedGain / totalAcquisitionCost) * 100
  pricePerSquareMeter: number | null; // estimatedValue / surface

  // Emprunts & Patrimoine Net Immobilier
  linkedLoans: LinkedLoanInfo[];
  totalRemainingDebt: number; // Somme des capitaux restants dus des prêts liés
  netEquity: number; // estimatedValue - totalRemainingDebt (Patrimoine net sur le bien)
  loanToValuePct: number | null; // (totalRemainingDebt / estimatedValue) * 100

  // Caractéristiques techniques
  floor: number | null;
  totalFloors: number | null;
  rooms: number;
  bedrooms: number;
  bathrooms: number;
  garages: number;
  parkingSpots: number;
  gardenSurface: number;
  terraceSurface: number;
  hasElevator: boolean;
  isNew: boolean;
  isFurnished: boolean;

  // Qualité / État des pièces
  kitchenQuality: string | null;
  kitchenCondition: string | null;
  bathroomQuality: string | null;
  bathroomCondition: string | null;
  flooringQuality: string | null;
  flooringCondition: string | null;
  windowsQuality: string | null;
  windowsCondition: string | null;
  generalQuality: string | null;
  generalCondition: string | null;

  // Détention
  ownershipPct: number;
  coOwners: string | null;

  createdAt: number;
  updatedAt: number;
}

export interface RealEstateSummary {
  properties: PropertySummary[];
  propertiesCount: number;
  totalGrossValue: number; // Somme des valeurs estimées (quote-part appliquée)
  totalRemainingDebt: number; // Somme des dettes rattachées
  totalNetEquity: number; // totalGrossValue - totalRemainingDebt
  totalAcquisitionCost: number;
  totalUnrealizedGain: number;
  totalUnrealizedGainPct: number | null;
  totalSurface: number;
  averagePricePerM2: number | null;
  totalMonthlyRent: number;
  totalMonthlyCashflow: number;
  activeLoansCount: number;
}
