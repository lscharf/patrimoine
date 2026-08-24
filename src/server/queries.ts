import "server-only";
import { cache } from "react";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, holdings, instruments, manualValues, transactions } from "@/db/schema";
import type { ManualValue, Transaction } from "@/db/schema";
import { requireUserId } from "./auth/session";
import { buildSnapshot } from "./portfolio/snapshot";
import { buildHistory } from "./portfolio/history";
import type {
  HistorySeries,
  HoldingSnapshot,
  PortfolioSnapshot,
  Range,
} from "./portfolio/types";

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
