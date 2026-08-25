import "server-only";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { fxBars, fxState, instruments, priceBars } from "@/db/schema";
import type { Instrument } from "@/db/schema";
import { yahooProvider } from "./yahoo";
import { isoDate, type Bar, type IntradayInterval, type Tick } from "./provider";

const provider = yahooProvider;

/** Un cours live plus frais que ça n'est pas re-téléchargé. */
const QUOTE_TTL_MS = 60_000;
/** Marge avant la date demandée, pour avoir une clôture à reporter en amont. */
const BACKFILL_PAD_DAYS = 10;

/**
 * Délai minimal entre deux sollicitations du fournisseur pour l'historique
 * d'un même instrument.
 *
 * La fraîcheur ne peut pas se juger sur un calendrier : une place européenne
 * n'a rien publié de neuf depuis vendredi, et la juger « périmée » le mardi
 * conduit à la réinterroger à chaque affichage sans jamais rien obtenir de
 * plus. On borne donc la fréquence des tentatives, indépendamment de l'état
 * du cache.
 */
const HISTORY_RECHECK_MS = 60 * 60_000;

/** L'intraday a un pas de 5 minutes : le rafraîchir plus souvent est vain. */
const INTRADAY_TTL_MS = 5 * 60_000;

export const BASE_CURRENCY = "EUR";

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoDate(new Date(y, m - 1, d + n));
}

export function today(): string {
  return isoDate(new Date());
}

/* ------------------------------------------------------------------ *
 * Instruments
 * ------------------------------------------------------------------ */

/** Crée l'instrument s'il n'existe pas, en interrogeant le fournisseur. */
export async function ensureInstrument(symbol: string): Promise<Instrument> {
  const sym = symbol.trim();
  const existing = db
    .select()
    .from(instruments)
    .where(eq(instruments.symbol, sym))
    .get();
  if (existing) return existing;

  const [quote] = await provider.quotes([sym]);
  if (!quote) throw new Error(`Symbole introuvable : ${sym}`);

  db.insert(instruments)
    .values({
      symbol: sym,
      name: quote.name,
      type: quote.type,
      currency: quote.currency,
      exchange: quote.exchange,
      lastPrice: quote.price,
      prevClose: quote.prevClose,
      lastPriceAt: Date.now(),
    })
    .run();

  return db.select().from(instruments).where(eq(instruments.symbol, sym)).get()!;
}

/**
 * Rafraîchit les cours live des instruments dont le cache a expiré.
 * Un échec réseau ne doit jamais casser l'affichage : on garde le dernier
 * prix connu et on continue.
 */
export async function refreshQuotes(ids?: number[]): Promise<void> {
  const rows = ids?.length
    ? db.select().from(instruments).where(inArray(instruments.id, ids)).all()
    : db.select().from(instruments).all();

  const cutoff = Date.now() - QUOTE_TTL_MS;
  const stale = rows.filter((r) => (r.lastPriceAt ?? 0) < cutoff);
  if (stale.length === 0) return;

  try {
    const quotes = await provider.quotes(stale.map((r) => r.symbol));
    const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));
    const now = Date.now();
    db.transaction((tx) => {
      for (const row of stale) {
        const q = bySymbol.get(row.symbol);
        if (!q) continue;
        tx.update(instruments)
          .set({
            lastPrice: q.price,
            prevClose: q.prevClose ?? row.prevClose,
            lastPriceAt: now,
            name: row.name || q.name,
            currency: q.currency,
          })
          .where(eq(instruments.id, row.id))
          .run();
      }
    });
  } catch (err) {
    console.warn("[prices] rafraîchissement des cours impossible :", err);
  }
}

/* ------------------------------------------------------------------ *
 * Historique des cours
 * ------------------------------------------------------------------ */

function upsertBars(instrumentId: number, bars: Bar[]) {
  if (bars.length === 0) return;
  db.transaction((tx) => {
    for (const b of bars) {
      tx.insert(priceBars)
        .values({ instrumentId, date: b.date, close: b.close })
        .onConflictDoUpdate({
          target: [priceBars.instrumentId, priceBars.date],
          set: { close: b.close },
        })
        .run();
    }
  });
}

/**
 * Garantit que le cache couvre [from, aujourd'hui] pour cet instrument.
 * Ne retélécharge que si la fenêtre demandée dépasse ce qui est déjà en base.
 */
export async function ensureDailyHistory(
  instrument: Instrument,
  from: string,
): Promise<void> {
  const bounds = db
    .select({
      min: sql<string | null>`min(${priceBars.date})`,
      max: sql<string | null>`max(${priceBars.date})`,
    })
    .from(priceBars)
    .where(eq(priceBars.instrumentId, instrument.id))
    .get();

  const padded = addDays(from, -BACKFILL_PAD_DAYS);
  const cachedMin = bounds?.min ?? null;
  const cachedMax = bounds?.max ?? null;

  // Un trou en amont est un vrai manque : la fenêtre demandée remonte plus loin
  // que ce qu'on possède, il faut aller le chercher tout de suite.
  // On ne redemande en amont que si la fenêtre remonte plus loin que ce qu'on
  // a *déjà réclamé*. Comparer à la plus ancienne barre reçue ne suffit pas :
  // quand le fournisseur ne remonte pas aussi loin, l'écart ne se comble
  // jamais et la requête se répéterait indéfiniment.
  const missingHead =
    !cachedMin ||
    (padded < cachedMin && (!instrument.historyFrom || padded < instrument.historyFrom));
  const staleTail = !cachedMax || cachedMax < addDays(today(), -1);
  const checkedRecently =
    (instrument.historyCheckedAt ?? 0) > Date.now() - HISTORY_RECHECK_MS;

  if (!missingHead && (!staleTail || checkedRecently)) return;

  const start = missingHead ? padded : addDays(cachedMax!, -5);
  try {
    const bars = await provider.dailyHistory(
      instrument.symbol,
      new Date(`${start}T00:00:00`),
    );
    upsertBars(instrument.id, bars);
    db.update(instruments)
      .set({
        historyThrough: bars.at(-1)?.date ?? instrument.historyThrough,
        historyCheckedAt: Date.now(),
        historyFrom: earliestOf(instrument.historyFrom, start),
      })
      .where(eq(instruments.id, instrument.id))
      .run();
  } catch (err) {
    // La tentative est horodatée même en échec : un fournisseur indisponible
    // ne doit pas déclencher une rafale de reprises à chaque affichage.
    db.update(instruments)
      .set({ historyCheckedAt: Date.now(), historyFrom: earliestOf(instrument.historyFrom, start) })
      .where(eq(instruments.id, instrument.id))
      .run();
    console.warn(`[prices] historique ${instrument.symbol} indisponible :`, err);
  }
}

export function readBars(instrumentId: number, from: string): Bar[] {
  return db
    .select({ date: priceBars.date, close: priceBars.close })
    .from(priceBars)
    .where(and(eq(priceBars.instrumentId, instrumentId), gte(priceBars.date, from)))
    .orderBy(priceBars.date)
    .all();
}

/** Dernière clôture connue à cette date ou avant — pour amorcer le report. */
export function lastCloseBefore(
  instrumentId: number,
  date: string,
): number | null {
  const row = db
    .select({ close: priceBars.close })
    .from(priceBars)
    .where(
      and(
        eq(priceBars.instrumentId, instrumentId),
        sql`${priceBars.date} <= ${date}`,
      ),
    )
    .orderBy(sql`${priceBars.date} desc`)
    .limit(1)
    .get();
  return row?.close ?? null;
}

/**
 * Cache mémoire de l'intraday.
 *
 * Contrairement aux clôtures, ces points ne sont pas stockés en base : ils sont
 * volumineux, éphémères, et ne servent qu'aux fenêtres 1J et 7J. Un cache de
 * processus suffit et évite huit requêtes à chaque bascule de période.
 */
const intradayCache = new Map<string, { at: number; ticks: Tick[] }>();

export async function intraday(
  symbol: string,
  from: Date,
  interval: IntradayInterval = "5m",
): Promise<Tick[]> {
  const key = `${symbol}|${interval}`;
  const hit = intradayCache.get(key);
  if (hit && hit.at > Date.now() - INTRADAY_TTL_MS) return hit.ticks;

  try {
    const ticks = await provider.intradayHistory(symbol, from, interval);
    intradayCache.set(key, { at: Date.now(), ticks });
    return ticks;
  } catch (err) {
    console.warn(`[prices] intraday ${symbol} indisponible :`, err);
    // On mémorise l'échec brièvement, pour la même raison que ci-dessus.
    intradayCache.set(key, { at: Date.now(), ticks: hit?.ticks ?? [] });
    return hit?.ticks ?? [];
  }
}

/* ------------------------------------------------------------------ *
 * Taux de change — tout est ramené en EUR
 * ------------------------------------------------------------------ */

/** "USD" -> paire "USDEUR", symbole Yahoo "USDEUR=X" */
function fxPair(currency: string) {
  return `${currency.toUpperCase()}${BASE_CURRENCY}`;
}

/**
 * Yahoo renvoie `USDEUR=X` sous le symbole `EUR=X` : impossible de faire
 * correspondre les résultats dans un appel groupé. On interroge donc les
 * devises une par une (il y en a une poignée au plus).
 */
export async function refreshFxRate(currency: string): Promise<number> {
  const cur = currency.toUpperCase();
  if (cur === BASE_CURRENCY) return 1;
  const pair = fxPair(cur);

  const cached = db.select().from(fxState).where(eq(fxState.pair, pair)).get();
  if (cached && cached.updatedAt > Date.now() - QUOTE_TTL_MS) return cached.rate;

  try {
    const [q] = await yahooProvider.quotes([`${pair}=X`]);
    if (q?.price) {
      db.insert(fxState)
        .values({ pair, rate: q.price, updatedAt: Date.now() })
        .onConflictDoUpdate({
          target: fxState.pair,
          set: { rate: q.price, updatedAt: Date.now() },
        })
        .run();
      return q.price;
    }
  } catch (err) {
    console.warn(`[fx] taux ${pair} indisponible :`, err);
  }
  return cached?.rate ?? 1;
}

export async function ensureFxHistory(
  currency: string,
  from: string,
): Promise<void> {
  const cur = currency.toUpperCase();
  if (cur === BASE_CURRENCY) return;
  const pair = fxPair(cur);

  const bounds = db
    .select({
      min: sql<string | null>`min(${fxBars.date})`,
      max: sql<string | null>`max(${fxBars.date})`,
    })
    .from(fxBars)
    .where(eq(fxBars.pair, pair))
    .get();

  const padded = addDays(from, -BACKFILL_PAD_DAYS);
  const state = db.select().from(fxState).where(eq(fxState.pair, pair)).get();
  const missingHead =
    !bounds?.min ||
    (padded < bounds.min && (!state?.historyFrom || padded < state.historyFrom));
  const staleTail = !bounds?.max || bounds.max < addDays(today(), -1);
  const checkedRecently =
    (state?.historyCheckedAt ?? 0) > Date.now() - HISTORY_RECHECK_MS;

  // Même raisonnement que pour les instruments : un marché des changes fermé
  // le week-end n'a rien de neuf à livrer, inutile de le redemander.
  if (!missingHead && (!staleTail || checkedRecently)) return;

  const start = missingHead ? padded : addDays(bounds!.max!, -5);
  try {
    const bars = await yahooProvider.dailyHistory(
      `${pair}=X`,
      new Date(`${start}T00:00:00`),
    );
    db.transaction((tx) => {
      for (const b of bars) {
        tx.insert(fxBars)
          .values({ pair, date: b.date, rate: b.close })
          .onConflictDoUpdate({
            target: [fxBars.pair, fxBars.date],
            set: { rate: b.close },
          })
          .run();
      }
    });
    markFxChecked(pair, start, bars.at(-1)?.date);
  } catch (err) {
    markFxChecked(pair, start);
    console.warn(`[fx] historique ${pair} indisponible :`, err);
  }
}

/** Horodate la tentative, qu'elle ait ramené des barres ou non. */
function markFxChecked(pair: string, requestedFrom: string, through?: string) {
  const existing = db.select().from(fxState).where(eq(fxState.pair, pair)).get();
  const from = earliestOf(existing?.historyFrom, requestedFrom);
  db.insert(fxState)
    .values({
      pair,
      rate: existing?.rate ?? 1,
      updatedAt: existing?.updatedAt ?? 0,
      historyThrough: through ?? existing?.historyThrough ?? null,
      historyCheckedAt: Date.now(),
      historyFrom: from,
    })
    .onConflictDoUpdate({
      target: fxState.pair,
      set: {
        historyCheckedAt: Date.now(),
        historyFrom: from,
        ...(through ? { historyThrough: through } : {}),
      },
    })
    .run();
}

/** La plus ancienne de deux dates ISO, en tolérant les valeurs absentes. */
function earliestOf(a: string | null | undefined, b: string): string {
  return a && a < b ? a : b;
}

export function readFxBars(currency: string, from: string): Bar[] {
  const cur = currency.toUpperCase();
  if (cur === BASE_CURRENCY) return [];
  return db
    .select({ date: fxBars.date, close: fxBars.rate })
    .from(fxBars)
    .where(and(eq(fxBars.pair, fxPair(cur)), gte(fxBars.date, from)))
    .orderBy(fxBars.date)
    .all();
}

/** Taux au plus proche à cette date ou avant — 1 si la devise est l'euro. */
export function fxRateOn(currency: string, date: string): number | null {
  const cur = currency.toUpperCase();
  if (cur === BASE_CURRENCY) return 1;
  const row = db
    .select({ rate: fxBars.rate })
    .from(fxBars)
    .where(and(eq(fxBars.pair, fxPair(cur)), sql`${fxBars.date} <= ${date}`))
    .orderBy(sql`${fxBars.date} desc`)
    .limit(1)
    .get();
  return row?.rate ?? null;
}

export { addDays };
