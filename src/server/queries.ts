import "server-only";
import { cache } from "react";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  holdings,
  instruments,
  loans,
  manualValues,
  realEstateProperties,
  transactions,
} from "@/db/schema";
import type { ManualValue, Transaction } from "@/db/schema";
import { requireUserId } from "@/server/auth/session";
import {
  computeLiabilitiesSummary,
  computeLoanDetail,
} from "./loans/amortization";
import {
  computePropertySummary,
  computeRealEstateSummary,
} from "./real-estate/calculations";
import type {
  PropertySummary,
  RealEstateSummary,
} from "./real-estate/types";
import { buildSnapshot } from "./portfolio/snapshot";
import { buildHistory } from "./portfolio/history";
import type {
  HistorySeries,
  HoldingSnapshot,
  PortfolioSnapshot,
  Range,
} from "./portfolio/types";
import type {
  LiabilitiesSummary,
  LoanDetail,
} from "./loans/types";
/**
 * `cache()` déduplique l'appel sur toute la durée d'un rendu : le tableau, le
 * graphique et l'entête consomment le même instantané sans le recalculer.
 */
export const getSnapshot = cache(async (): Promise<PortfolioSnapshot> =>
  buildSnapshot(await requireUserId()),
);

export const getHistory = cache(
  async (
    range: Range,
    opts?: { accountId?: number; holdingId?: number },
  ): Promise<HistorySeries> => {
    const snapshot = await getSnapshot();
    const liveTotal =
      opts?.holdingId != null
        ? (snapshot.holdings.find((h) => h.id === opts.holdingId)?.value ?? 0)
        : opts?.accountId != null
          ? (snapshot.accounts.find((a) => a.id === opts.accountId)?.value ?? 0)
          : snapshot.totalValue;

    return buildHistory(range, {
      ...opts,
      userId: await requireUserId(),
      liveTotal,
      // Valeur courante de chaque ligne : évite de recalculer la clôture du
      // jour alors que l'instantané dispose déjà du cours temps réel.
      liveValues: new Map(snapshot.holdings.map((h) => [h.id, h.value])),
    });
  },
);

export const getAccounts = cache(async () => {
  const userId = await requireUserId();
  return db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .orderBy(accounts.position, accounts.id)
    .all();
});

export type HoldingDetail = {
  holding: HoldingSnapshot;
  transactions: Transaction[];
  valuations: ManualValue[];
};

export const getHoldingDetail = cache(
  async (id: number): Promise<HoldingDetail | null> => {
    const snapshot = await getSnapshot();
    // L'instantané ne contient que les lignes de l'utilisateur : ne pas la
    // trouver ici vaut refus, y compris si l'identifiant existe ailleurs.
    const holding = snapshot.holdings.find((h) => h.id === id);
    if (!holding) return null;

    return {
      holding,
      transactions: db
        .select()
        .from(transactions)
        .where(eq(transactions.holdingId, id))
        .orderBy(desc(transactions.date), desc(transactions.id))
        .all(),
      valuations: db
        .select()
        .from(manualValues)
        .where(eq(manualValues.holdingId, id))
        .orderBy(desc(manualValues.date))
        .all(),
    };
  },
);

/** Toutes les transactions de l'utilisateur, les plus récentes d'abord. */
export const getRecentTransactions = cache(async (limit = 40) => {
  const userId = await requireUserId();
  return db
    .select({
      tx: transactions,
      holdingLabel: holdings.label,
      holdingId: holdings.id,
      accountName: accounts.name,
      accountColor: accounts.color,
      currency: holdings.currency,
      symbol: instruments.symbol,
    })
    .from(transactions)
    .innerJoin(holdings, eq(transactions.holdingId, holdings.id))
    .innerJoin(accounts, eq(holdings.accountId, accounts.id))
    .leftJoin(instruments, eq(holdings.instrumentId, instruments.id))
    .where(eq(accounts.userId, userId))
    .orderBy(desc(transactions.date), desc(transactions.id))
    .limit(limit)
    .all();
});

export const getAccountDetail = cache(async (id: number) => {
  const snapshot = await getSnapshot();
  const account = snapshot.accounts.find((a) => a.id === id);
  if (!account) return null;
  return account;
});

export const getInstruments = cache(async () =>
  db.select().from(instruments).orderBy(asc(instruments.symbol)).all(),
);

export const getLiabilities = cache(async (): Promise<LiabilitiesSummary> => {
  const userId = await requireUserId();
  const loanRows = db
    .select()
    .from(loans)
    .where(eq(loans.userId, userId))
    .orderBy(desc(loans.createdAt))
    .all();

  const accountRows = db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .all();
  const accountsMap = new Map<number, string>(
    accountRows.map((a) => [a.id, a.name]),
  );

  const holdingRows = db
    .select({ id: holdings.id, label: holdings.label })
    .from(holdings)
    .innerJoin(accounts, eq(holdings.accountId, accounts.id))
    .where(eq(accounts.userId, userId))
    .all();
  const holdingsMap = new Map<number, string>(
    holdingRows.map((h) => [h.id, h.label]),
  );

  return computeLiabilitiesSummary(loanRows, { accountsMap, holdingsMap });
});

export const getLoanDetail = cache(
  async (id: number): Promise<LoanDetail | null> => {
    const userId = await requireUserId();
    const loan = db
      .select()
      .from(loans)
      .where(and(eq(loans.id, id), eq(loans.userId, userId)))
      .get();

    if (!loan) return null;

    let linkedAccountName: string | null = null;
    if (loan.accountId) {
      const acc = db
        .select({ name: accounts.name })
        .from(accounts)
        .where(and(eq(accounts.id, loan.accountId), eq(accounts.userId, userId)))
        .get();
      linkedAccountName = acc?.name ?? null;
    }

    let linkedHoldingLabel: string | null = null;
    if (loan.holdingId) {
      const h = db
        .select({ label: holdings.label })
        .from(holdings)
        .innerJoin(accounts, eq(holdings.accountId, accounts.id))
        .where(and(eq(holdings.id, loan.holdingId), eq(accounts.userId, userId)))
        .get();
      linkedHoldingLabel = h?.label ?? null;
    }

    return computeLoanDetail(loan, { linkedAccountName, linkedHoldingLabel });
  },
);

export const getRealEstate = cache(async (): Promise<RealEstateSummary> => {
  const userId = await requireUserId();
  const [propertyRows, liabilities] = await Promise.all([
    db
      .select()
      .from(realEstateProperties)
      .where(eq(realEstateProperties.userId, userId))
      .orderBy(desc(realEstateProperties.estimatedValue))
      .all(),
    getLiabilities(),
  ]);

  return computeRealEstateSummary(propertyRows, liabilities.loans);
});

export const getPropertyDetail = cache(
  async (id: number): Promise<PropertySummary | null> => {
    const userId = await requireUserId();
    const [property, liabilities] = await Promise.all([
      db
        .select()
        .from(realEstateProperties)
        .where(
          and(
            eq(realEstateProperties.id, id),
            eq(realEstateProperties.userId, userId),
          ),
        )
        .get(),
      getLiabilities(),
    ]);

    if (!property) return null;
    return computePropertySummary(property, liabilities.loans);
  },
);

export const getSimpleProperties = cache(async () => {
  const userId = await requireUserId();
  return db
    .select({
      id: realEstateProperties.id,
      name: realEstateProperties.name,
      category: realEstateProperties.category,
    })
    .from(realEstateProperties)
    .where(eq(realEstateProperties.userId, userId))
    .orderBy(asc(realEstateProperties.name))
    .all();
});
