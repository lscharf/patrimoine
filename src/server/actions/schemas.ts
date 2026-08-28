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
  AMORTIZING: "Prêt amortissable (standard)",
  IN_FINE: "Prêt in fine",
  PTZ: "Prêt à taux zéro (PTZ)",
  OTHER: "Autre prêt",
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
  accountId: z.coerce.number().int().positive().nullable().optional(),
  holdingId: z.coerce.number().int().positive().nullable().optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type AccountInput = z.infer<typeof accountInput>;
export type QuotedHoldingInput = z.infer<typeof quotedHoldingInput>;
export type ManualHoldingInput = z.infer<typeof manualHoldingInput>;
export type TransactionInput = z.infer<typeof transactionInput>;
export type ManualValueInput = z.infer<typeof manualValueInput>;
export type LoanInput = z.infer<typeof loanInput>;
