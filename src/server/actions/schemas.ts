import { z } from "zod";

export const ACCOUNT_KINDS = [
  "PEA",
  "CTO",
  "PEE",
  "AV",
  "LIVRET",
  "CRYPTO",
  "OTHER",
] as const;

export const ACCOUNT_KIND_LABELS: Record<
  (typeof ACCOUNT_KINDS)[number],
  string
> = {
  PEA: "PEA",
  CTO: "Compte-titres",
  PEE: "Épargne salariale",
  AV: "Assurance-vie",
  LIVRET: "Livret",
  CRYPTO: "Crypto",
  OTHER: "Autre",
};

export const TX_TYPES = [
  "BUY",
  "SELL",
  "DIVIDEND",
  "FEE",
  "DEPOSIT",
  "WITHDRAWAL",
] as const;

export const TX_TYPE_LABELS: Record<(typeof TX_TYPES)[number], string> = {
  BUY: "Achat",
  SELL: "Vente",
  DIVIDEND: "Dividende",
  FEE: "Frais",
  DEPOSIT: "Versement",
  WITHDRAWAL: "Retrait",
};

export const LOAN_KINDS = [
  "AMORTIZING",
  "IN_FINE",
  "PTZ",
  "OTHER",
] as const;

export const LOAN_KIND_LABELS: Record<
  (typeof LOAN_KINDS)[number],
  string
> = {
  AMORTIZING: "Prêt amortissable",
  IN_FINE: "Prêt in fine",
  PTZ: "Prêt à taux zéro",
  OTHER: "Autre crédit",
};

export const PROPERTY_TYPES = [
  "APPARTEMENT",
  "MAISON",
  "TERRAIN",
  "PARKING",
  "IMMEUBLE",
  "LOCAL_COMMERCIAL",
  "AUTRE",
] as const;

export const PROPERTY_TYPE_LABELS: Record<
  (typeof PROPERTY_TYPES)[number],
  string
> = {
  APPARTEMENT: "Appartement",
  MAISON: "Maison",
  TERRAIN: "Terrain",
  PARKING: "Parking / Box",
  IMMEUBLE: "Immeuble",
  LOCAL_COMMERCIAL: "Local commercial",
  AUTRE: "Autre bien",
};

export const PROPERTY_CATEGORIES = [
  "RESIDENCE_PRINCIPALE",
  "RESIDENCE_SECONDAIRE",
  "LOCATIF",
  "AUTRE",
] as const;

export const PROPERTY_CATEGORY_LABELS: Record<
  (typeof PROPERTY_CATEGORIES)[number],
  string
> = {
  RESIDENCE_PRINCIPALE: "Résidence principale",
  RESIDENCE_SECONDAIRE: "Résidence secondaire",
  LOCATIF: "Investissement locatif",
  AUTRE: "Autre usage",
};

export const ROOM_QUALITIES = [
  "STANDARD",
  "HIGH_END",
  "EXCEPTIONAL",
] as const;

export const ROOM_QUALITY_LABELS: Record<
  (typeof ROOM_QUALITIES)[number],
  string
> = {
  STANDARD: "Standard",
  HIGH_END: "Haut de gamme",
  EXCEPTIONAL: "Matériaux d'exception",
};

export const ROOM_CONDITIONS = [
  "TO_RENOVATE",
  "GOOD",
  "WELL_MAINTAINED",
  "NEW",
] as const;

export const ROOM_CONDITION_LABELS: Record<
  (typeof ROOM_CONDITIONS)[number],
  string
> = {
  TO_RENOVATE: "À rénover",
  GOOD: "Bon état",
  WELL_MAINTAINED: "Bien entretenu",
  NEW: "Neuf ou récemment rénové",
};
const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ");

/** Accepte « 1 234,56 » comme « 1234.56 » — les champs viennent d'un formulaire. */
const decimal = z.preprocess((v) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/\s/g, "").replace(",", ".");
    if (cleaned === "") return undefined;
    const n = Number(cleaned);
    return Number.isNaN(n) ? v : n;
  }
  return v;
}, z.number());

const positive = decimal.pipe(z.number().positive("La valeur doit être positive"));
const nonNegative = decimal.pipe(
  z.number().min(0, "La valeur ne peut pas être négative"),
);

export const accountInput = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire").max(80),
  kind: z.enum(ACCOUNT_KINDS),
  institution: z.string().trim().max(80).optional().or(z.literal("")),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Couleur hexadécimale attendue")
    .optional(),
});

export const quotedHoldingInput = z.object({
  accountId: z.coerce.number().int().positive(),
  symbol: z.string().trim().min(1, "Choisissez un instrument"),
  label: z.string().trim().max(80).optional().or(z.literal("")),
  date: isoDay,
  quantity: positive,
  unitPrice: nonNegative,
  fees: nonNegative.optional(),
});

export const manualHoldingInput = z.object({
  accountId: z.coerce.number().int().positive(),
  label: z.string().trim().min(1, "Le nom est obligatoire").max(80),
  date: isoDay,
  /** Montant versé */
  amount: nonNegative,
  /** Valorisation actuelle — par défaut, égale au versement */
  value: nonNegative.optional(),
});

export const transactionInput = z
  .object({
    holdingId: z.coerce.number().int().positive(),
    type: z.enum(TX_TYPES),
    date: isoDay,
    quantity: nonNegative.optional(),
    unitPrice: nonNegative.optional(),
    fees: nonNegative.optional(),
    amount: nonNegative.optional(),
    note: z.string().trim().max(200).optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (v.type === "BUY" || v.type === "SELL") {
      if (!v.quantity || v.quantity <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["quantity"],
          message: "Quantité obligatoire",
        });
      }
      if (v.unitPrice == null) {
        ctx.addIssue({
          code: "custom",
          path: ["unitPrice"],
          message: "Prix unitaire obligatoire",
        });
      }
    } else if (!v.amount || v.amount <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Montant obligatoire",
      });
    }
  });

export const manualValueInput = z.object({
  holdingId: z.coerce.number().int().positive(),
  date: isoDay,
  value: nonNegative,
});

export const loanInput = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire").max(100),
  type: z.enum(LOAN_KINDS).default("AMORTIZING"),
  borrowedAmount: positive,
  downPayment: nonNegative.optional(),
  initialFees: nonNegative.optional(),
  interestRate: nonNegative,
  insuranceRate: nonNegative.optional(),
  durationMonths: z.coerce
    .number()
    .int()
    .min(1, "La durée minimale est de 1 mois")
    .max(600, "Durée maximale 50 ans"),
  startDate: isoDay,
  customMonthlyPayment: nonNegative.optional(),
  currentBalance: nonNegative.nullable().optional(),
  currentBalanceDate: z.string().trim().regex(/^\d{4}-\d{2}(-\d{2})?$/, "Format YYYY-MM ou YYYY-MM-DD attendu").nullable().optional().or(z.literal("")),
  groupName: z.string().trim().max(100).optional().or(z.literal("")),
  accountId: z.coerce.number().int().positive().nullable().optional(),
  holdingId: z.coerce.number().int().positive().nullable().optional(),
  propertyId: z.coerce.number().int().positive().nullable().optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const propertyInput = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire").max(150),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  type: z.enum(PROPERTY_TYPES).default("APPARTEMENT"),
  category: z.enum(PROPERTY_CATEGORIES).default("RESIDENCE_PRINCIPALE"),
  address: z.string().trim().max(250).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  zipcode: z.string().trim().max(20).optional().or(z.literal("")),
  surface: nonNegative,
  purchasePrice: nonNegative,
  purchaseDate: isoDay.optional().or(z.literal("")),
  notaryFees: nonNegative.optional(),
  renovationCosts: nonNegative.optional(),
  estimatedValue: nonNegative,
  monthlyRent: nonNegative.optional(),
  condoFees: nonNegative.optional(),
  propertyTax: nonNegative.optional(),
  floor: z.coerce.number().int().nullable().optional(),
  totalFloors: z.coerce.number().int().nullable().optional(),
  rooms: z.coerce.number().int().min(1).default(1),
  bedrooms: z.coerce.number().int().min(0).default(1),
  bathrooms: z.coerce.number().int().min(0).default(1),
  garages: z.coerce.number().int().min(0).default(0),
  parkingSpots: z.coerce.number().int().min(0).default(0),
  gardenSurface: nonNegative.optional(),
  terraceSurface: nonNegative.optional(),
  hasElevator: z.boolean().default(false),
  isNew: z.boolean().default(false),
  isFurnished: z.boolean().default(false),
  kitchenQuality: z.string().optional().or(z.literal("")),
  kitchenCondition: z.string().optional().or(z.literal("")),
  bathroomQuality: z.string().optional().or(z.literal("")),
  bathroomCondition: z.string().optional().or(z.literal("")),
  flooringQuality: z.string().optional().or(z.literal("")),
  flooringCondition: z.string().optional().or(z.literal("")),
  windowsQuality: z.string().optional().or(z.literal("")),
  windowsCondition: z.string().optional().or(z.literal("")),
  generalQuality: z.string().optional().or(z.literal("")),
  generalCondition: z.string().optional().or(z.literal("")),
  ownershipPct: z.coerce.number().min(0).max(100).default(100),
  coOwners: z.string().optional().or(z.literal("")),
});

export type AccountInput = z.infer<typeof accountInput>;
export type QuotedHoldingInput = z.infer<typeof quotedHoldingInput>;
export type ManualHoldingInput = z.infer<typeof manualHoldingInput>;
export type TransactionInput = z.infer<typeof transactionInput>;
export type ManualValueInput = z.infer<typeof manualValueInput>;
export type LoanInput = z.infer<typeof loanInput>;
export type PropertyInput = z.infer<typeof propertyInput>;
