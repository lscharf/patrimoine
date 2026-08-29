import "server-only";
import { and, desc, eq } from "drizzle-orm";
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
import type { Instrument, Transaction } from "@/db/schema";
import {
  ensureFxHistory,
  fxRateOn,
  refreshFxRate,
  refreshQuotes,
} from "@/server/prices/cache";
import { computeLiabilitiesSummary } from "@/server/loans/amortization";
import { computeRealEstateSummary } from "@/server/real-estate/calculations";
import { computeCostBasis } from "./cost-basis";
import type {
  AccountSnapshot,
  HoldingKind,
  HoldingSnapshot,
  PortfolioSnapshot,
} from "./types";

/** Les cours plus vieux que ça sont signalés comme périmés dans l'interface. */
const STALE_AFTER_MS = 30 * 60_000;

export type LoadedHolding = {
  id: number;
  accountId: number;
  label: string;
  kind: HoldingKind;
  currency: string;
  instrumentId: number | null;
  instrument: Instrument | null;
  txs: Transaction[];
};

/**
 * Charge le portefeuille d'un utilisateur en mémoire — SQLite local, quelques ms.
 *
 * Le filtre sur le propriétaire est appliqué aux **trois** requêtes, et non
 * seulement aux comptes : une jointure oubliée sur les lignes ou les
 * transactions exposerait les données d'un autre utilisateur.
 */
export function loadPortfolio(userId: string) {
  const accountRows = db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .orderBy(accounts.position, accounts.id)
    .all();

  const holdingRows = db
    .select({ h: holdings, i: instruments })
    .from(holdings)
    .innerJoin(accounts, eq(holdings.accountId, accounts.id))
    .leftJoin(instruments, eq(holdings.instrumentId, instruments.id))
    .where(eq(accounts.userId, userId))
    .orderBy(holdings.position, holdings.id)
    .all();

  const txRows = db
    .select({ t: transactions })
    .from(transactions)
    .innerJoin(holdings, eq(transactions.holdingId, holdings.id))
    .innerJoin(accounts, eq(holdings.accountId, accounts.id))
    .where(eq(accounts.userId, userId))
    .all()
    .map((r) => r.t);
  const txByHolding = new Map<number, Transaction[]>();
  for (const tx of txRows) {
    const list = txByHolding.get(tx.holdingId);
    if (list) list.push(tx);
    else txByHolding.set(tx.holdingId, [tx]);
  }

  const loaded: LoadedHolding[] = holdingRows.map(({ h, i }) => ({
    id: h.id,
    accountId: h.accountId,
    label: h.label,
    kind: h.kind as HoldingKind,
    currency: h.currency,
    instrumentId: h.instrumentId,
    instrument: i ?? null,
    txs: txByHolding.get(h.id) ?? [],
  }));

  return { accounts: accountRows, holdings: loaded, transactions: txRows };
}

/** Dernière valorisation saisie pour une ligne non cotée. */
export function latestManualValue(
  holdingId: number,
  userId: string,
): number | null {
  const row = db
    .select({ value: manualValues.value })
    .from(manualValues)
    .innerJoin(holdings, eq(manualValues.holdingId, holdings.id))
    .innerJoin(accounts, eq(holdings.accountId, accounts.id))
    .where(and(eq(manualValues.holdingId, holdingId), eq(accounts.userId, userId)))
    .orderBy(desc(manualValues.date))
    .limit(1)
    .get();
  return row?.value ?? null;
}

/**
 * Prépare les taux de change : rafraîchit le taux courant de chaque devise
 * présente au portefeuille et remplit l'historique depuis la plus ancienne
 * transaction, afin de convertir chaque achat au taux qui avait cours ce
 * jour-là.
 */
export async function prepareFx(
  loaded: LoadedHolding[],
): Promise<Map<string, number>> {
  const currencies = new Set<string>();
  let earliest: string | null = null;
  for (const h of loaded) {
    currencies.add(h.currency.toUpperCase());
    for (const tx of h.txs) {
      if (!earliest || tx.date < earliest) earliest = tx.date;
    }
  }
  currencies.delete("EUR");

  const rates = new Map<string, number>([["EUR", 1]]);
  await Promise.all(
    [...currencies].map(async (cur) => {
      rates.set(cur, await refreshFxRate(cur));
      if (earliest) await ensureFxHistory(cur, earliest);
    }),
  );
  return rates;
}

/** Convertisseur devise→EUR à une date, avec repli sur le taux courant. */
export function makeFxOn(currency: string, spot: number) {
  const cur = currency.toUpperCase();
  if (cur === "EUR") return () => 1;
  return (date: string) => fxRateOn(cur, date) ?? spot;
}

export async function buildSnapshot(userId: string): Promise<PortfolioSnapshot> {
  const { accounts: accountRows, holdings: loaded } = loadPortfolio(userId);

  const instrumentIds = [
    ...new Set(
      loaded.map((h) => h.instrumentId).filter((id): id is number => id != null),
    ),
  ];
  await refreshQuotes(instrumentIds);
  const rates = await prepareFx(loaded);

  // refreshQuotes a pu mettre à jour les cours : on relit les instruments.
  const freshInstruments = new Map(
    db
      .select()
      .from(instruments)
      .all()
      .map((i) => [i.id, i]),
  );

  const now = Date.now();
  const snapshots: HoldingSnapshot[] = [];
  const accountById = new Map(accountRows.map((a) => [a.id, a]));

  for (const h of loaded) {
    const account = accountById.get(h.accountId);
    if (!account) continue;

    const instrument = h.instrumentId
      ? (freshInstruments.get(h.instrumentId) ?? h.instrument)
      : null;
    const currency = (instrument?.currency ?? h.currency).toUpperCase();
    const spot = rates.get(currency) ?? 1;
    const basis = computeCostBasis(h.txs, makeFxOn(currency, spot));

    let value: number;
    let lastPrice: number | null = null;
    let dayChange: number | null = null;
    let stale = false;

    if (h.kind === "QUOTED" && instrument) {
      lastPrice = instrument.lastPrice ?? null;
      stale = (instrument.lastPriceAt ?? 0) < now - STALE_AFTER_MS;
      value = lastPrice != null ? basis.quantity * lastPrice * spot : 0;
      if (lastPrice != null && instrument.prevClose != null) {
        dayChange = basis.quantity * (lastPrice - instrument.prevClose) * spot;
      }
    } else {
      // Non coté : la dernière valorisation saisie fait foi ; à défaut, on
      // retombe sur les versements cumulés.
      const manual = latestManualValue(h.id, userId);
      value = (manual ?? basis.costLocal) * spot;
    }

    const costBasis = basis.costEur;
    const unrealizedPL = value - costBasis;
    const prevValue = dayChange != null ? value - dayChange : null;

    snapshots.push({
      id: h.id,
      label: h.label,
      kind: h.kind,
      accountId: account.id,
      accountName: account.name,
      accountColor: account.color,
      symbol: instrument?.symbol ?? null,
      instrumentType: instrument?.type ?? null,
      currency,
      quantity: basis.quantity,
      avgCost: basis.avgCost,
      lastPrice,
      fxRate: spot,
      value,
      costBasis,
      unrealizedPL,
      unrealizedPLPct: costBasis > 0 ? unrealizedPL / costBasis : null,
      realizedPL: basis.realized,
      dividends: basis.dividends,
      fees: basis.fees,
      dayChange,
      dayChangePct:
        dayChange != null && prevValue && prevValue !== 0
          ? dayChange / prevValue
          : null,
      weight: 0,
      stale,
    });
  }

  const totalValue = snapshots.reduce((s, h) => s + h.value, 0);
  for (const h of snapshots) {
    h.weight = totalValue > 0 ? h.value / totalValue : 0;
  }

  const accountSnapshots: AccountSnapshot[] = accountRows.map((a) => {
    const own = snapshots.filter((h) => h.accountId === a.id);
    const value = own.reduce((s, h) => s + h.value, 0);
    const costBasis = own.reduce((s, h) => s + h.costBasis, 0);
    const dayChange = own.reduce((s, h) => s + (h.dayChange ?? 0), 0);
    const prevValue = value - dayChange;
    const unrealizedPL = value - costBasis;
    return {
      id: a.id,
      name: a.name,
      kind: a.kind,
      institution: a.institution,
      currency: a.currency,
      color: a.color,
      value,
      costBasis,
      unrealizedPL,
      unrealizedPLPct: costBasis > 0 ? unrealizedPL / costBasis : null,
      dayChange,
      dayChangePct: prevValue > 0 ? dayChange / prevValue : null,
      weight: totalValue > 0 ? value / totalValue : 0,
      holdings: own.sort((x, y) => y.value - x.value),
    };
  });

  const totalCostBasis = snapshots.reduce((s, h) => s + h.costBasis, 0);
  const unrealizedPL = totalValue - totalCostBasis;
  const dayChange = snapshots.reduce((s, h) => s + (h.dayChange ?? 0), 0);
  const prevTotal = totalValue - dayChange;

  const userLoans = db.select().from(loans).where(eq(loans.userId, userId)).all();
  const liabilities = computeLiabilitiesSummary(userLoans);
  const totalLiabilities = liabilities.totalRemainingCapital;

  const userProperties = db
    .select()
    .from(realEstateProperties)
    .where(eq(realEstateProperties.userId, userId))
    .all();
  const realEstateSummary = computeRealEstateSummary(
    userProperties,
    liabilities.loans,
  );
  const realEstateValue = realEstateSummary.totalGrossValue;
  const realEstateNetEquity = realEstateSummary.totalNetEquity;
  const grossAssets = totalValue + realEstateValue;
  const netWorth = grossAssets - totalLiabilities;

  return {
    totalValue,
    realEstateValue,
    realEstateNetEquity,
    realEstatePropertiesCount: realEstateSummary.propertiesCount,
    grossAssets,
    totalLiabilities,
    netWorth,
    monthlyLoanPayment: liabilities.totalMonthlyPayment,
    loansCount: liabilities.loansCount,
    totalCostBasis,
    unrealizedPL,
    unrealizedPLPct: totalCostBasis > 0 ? unrealizedPL / totalCostBasis : null,
    realizedPL: snapshots.reduce((s, h) => s + h.realizedPL, 0),
    dividends: snapshots.reduce((s, h) => s + h.dividends, 0),
    fees: snapshots.reduce((s, h) => s + h.fees, 0),
    dayChange,
    dayChangePct: prevTotal > 0 ? dayChange / prevTotal : null,
    accounts: accountSnapshots.sort((a, b) => b.value - a.value),
    holdings: [...snapshots].sort((a, b) => b.value - a.value),
    updatedAt: now,
  };
}
