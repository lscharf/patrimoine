/**
 * Contrat du fournisseur de cours. Toute la logique métier passe par ici :
 * changer Yahoo pour Twelve Data ou CoinGecko ne touche qu'un seul fichier.
 */

export type SearchHit = {
  symbol: string;
  name: string;
  /** ETF | EQUITY | CRYPTOCURRENCY | MUTUALFUND | INDEX | CURRENCY */
  type: string;
  exchange?: string;
  currency?: string;
};

export type Quote = {
  symbol: string;
  name: string;
  type: string;
  currency: string;
  exchange?: string;
  price: number;
  /** Clôture de la veille — sert à la variation du jour */
  prevClose?: number;
};

/** Barre journalière : date en YYYY-MM-DD, clôture dans la devise de cotation */
export type Bar = { date: string; close: number };

/** Point intraday : timestamp epoch ms */
export type Tick = { t: number; close: number };

/** Pas de temps intraday accepté par le fournisseur */
export type IntradayInterval = "5m" | "15m" | "30m" | "1h";

export interface PriceProvider {
  search(query: string): Promise<SearchHit[]>;
  quotes(symbols: string[]): Promise<Quote[]>;
  dailyHistory(symbol: string, from: Date, to?: Date): Promise<Bar[]>;
  intradayHistory(
    symbol: string,
    from: Date,
    interval?: IntradayInterval,
  ): Promise<Tick[]>;
}

/** YYYY-MM-DD dans le fuseau local, sans dérive UTC */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
