import "server-only";
import { cache } from "react";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, holdings, instruments, manualValues, transactions } from "@/db/schema";
import type { ManualValue, Transaction } from "@/db/schema";
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
export const getSnapshot = cache(
  async (): Promise<PortfolioSnapshot> => buildSnapshot(),
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

    return buildHistory(range, { ...opts, liveTotal });
  },
);

export const getAccounts = cache(async () =>
  db.select().from(accounts).orderBy(accounts.position, accounts.id).all(),
);

export type HoldingDetail = {
  holding: HoldingSnapshot;
  transactions: Transaction[];
  valuations: ManualValue[];
};

export const getHoldingDetail = cache(
  async (id: number): Promise<HoldingDetail | null> => {
    const snapshot = await getSnapshot();
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

/** Toutes les transactions du portefeuille, les plus récentes d'abord. */
export const getRecentTransactions = cache(async (limit = 40) =>
  db
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
    .orderBy(desc(transactions.date), desc(transactions.id))
    .limit(limit)
    .all(),
);

export const getAccountDetail = cache(async (id: number) => {
  const snapshot = await getSnapshot();
  const account = snapshot.accounts.find((a) => a.id === id);
  if (!account) return null;
  return account;
});

export const getInstruments = cache(async () =>
  db.select().from(instruments).orderBy(asc(instruments.symbol)).all(),
);
