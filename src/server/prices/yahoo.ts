import "server-only";
import YahooFinance from "yahoo-finance2";
import type {
  Bar,
  IntradayInterval,
  PriceProvider,
  Quote,
  SearchHit,
  Tick,
} from "./provider";
import { isoDate } from "./provider";

const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
  validation: { logErrors: false, logOptionsErrors: false },
});

/** Types qu'on accepte d'ajouter en portefeuille */
const TRADEABLE = new Set([
  "ETF",
  "EQUITY",
  "CRYPTOCURRENCY",
  "MUTUALFUND",
  "INDEX",
  "CURRENCY",
]);

/** Yahoo renvoie parfois GBp (pence) : on ramène en GBP côté valorisation. */
function normalizeCurrency(cur: string | undefined): string {
  if (!cur) return "EUR";
  return cur.toUpperCase() === "GBP" ? "GBP" : cur.toUpperCase();
}

/** Un titre coté en pence est renvoyé ×100 par Yahoo. */
function priceScale(cur: string | undefined): number {
  return cur === "GBp" ? 0.01 : 1;
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Un symbole inconnu ne sera jamais résolu par un retry.
      if (/not found|No data found|Quote not found/i.test(msg)) throw err;
      await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
    }
  }
  throw new Error(
    `${label} a échoué après 3 tentatives : ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}

export const yahooProvider: PriceProvider = {
  async search(query) {
    if (!query.trim()) return [];
    const res = await withRetry(
      () => yf.search(query, { quotesCount: 15, newsCount: 0 }),
      "search",
    );
    const hits: SearchHit[] = [];
    for (const raw of res.quotes) {
      // L'union de types renvoyée par yahoo-finance2 est trop large pour un
      // accès direct : on la lit comme un enregistrement générique.
      const q = raw as Record<string, unknown>;
      const symbol = typeof q.symbol === "string" ? q.symbol : null;
      if (!symbol) continue;
      const type = String(q.quoteType ?? "").toUpperCase();
      if (!TRADEABLE.has(type)) continue;
      const shortname = typeof q.shortname === "string" ? q.shortname : null;
      const longname = typeof q.longname === "string" ? q.longname : null;
      hits.push({
        symbol,
        name: shortname ?? longname ?? symbol,
        type,
        exchange: typeof q.exchange === "string" ? q.exchange : undefined,
      });
    }
    return hits;
  },

  async quotes(symbols) {
    if (symbols.length === 0) return [];
    const raw = await withRetry(
      () => yf.quote(symbols, { return: "array" }),
      "quote",
    );
    const out: Quote[] = [];
    for (const q of raw) {
      const price = q.regularMarketPrice;
      if (typeof price !== "number") continue;
      const scale = priceScale(q.currency);
      out.push({
        symbol: q.symbol,
        name: q.shortName ?? q.longName ?? q.symbol,
        type: String(q.quoteType ?? "EQUITY").toUpperCase(),
        currency: normalizeCurrency(q.currency),
        exchange: q.fullExchangeName ?? q.exchange,
        price: price * scale,
        prevClose:
          typeof q.regularMarketPreviousClose === "number"
            ? q.regularMarketPreviousClose * scale
            : undefined,
      });
    }
    return out;
  },

  async dailyHistory(symbol, from, to) {
    // yahoo-finance2 rejette period2: undefined — la clé doit être absente.
    const opts: { period1: Date; interval: "1d"; period2?: Date } = {
      period1: from,
      interval: "1d",
    };
    if (to) opts.period2 = to;
    const res = await withRetry(
      () => yf.chart(symbol, opts),
      `history(${symbol})`,
    );
    const scale = priceScale(res.meta?.currency);
    const bars: Bar[] = [];
    for (const q of res.quotes) {
      // La barre du jour en cours a une clôture nulle : on l'ignore,
      // le prix live la remplace.
      if (q.close == null || !q.date) continue;
      bars.push({ date: isoDate(new Date(q.date)), close: q.close * scale });
    }
    return bars;
  },

  async intradayHistory(symbol, from, interval: IntradayInterval = "5m") {
    const res = await withRetry(
      () => yf.chart(symbol, { period1: from, interval }),
      `intraday(${symbol})`,
    );
    const scale = priceScale(res.meta?.currency);
    const ticks: Tick[] = [];
    for (const q of res.quotes) {
      if (q.close == null || !q.date) continue;
      ticks.push({ t: new Date(q.date).getTime(), close: q.close * scale });
    }
    return ticks;
  },
};
