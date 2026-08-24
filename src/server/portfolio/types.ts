/** Fenêtres temporelles du sélecteur de graphique */
export const RANGES = ["1J", "7J", "1M", "3M", "6M", "YTD", "1A", "TOUT"] as const;
export type Range = (typeof RANGES)[number];

export type HoldingKind = "QUOTED" | "MANUAL";

export type TxType =
  | "BUY"
  | "SELL"
  | "DIVIDEND"
  | "FEE"
  | "DEPOSIT"
  | "WITHDRAWAL";

/** Résultat du parcours des transactions d'une ligne */
export type CostBasis = {
  /** Titres détenus (0 pour une ligne non cotée) */
  quantity: number;
  /** Prix de revient dans la devise de la ligne */
  costLocal: number;
  /** Prix de revient en euros, converti au taux du jour de chaque transaction */
  costEur: number;
  /** Prix de revient unitaire (PRU) dans la devise de la ligne */
  avgCost: number | null;
  /** Plus/moins-value réalisée sur les ventes, en euros */
  realized: number;
  /** Dividendes encaissés, en euros */
  dividends: number;
  /** Frais supportés, en euros */
  fees: number;
  /** Apports nets (achats + versements − ventes − retraits), en euros */
  invested: number;
  /** Date de la première transaction, YYYY-MM-DD */
  firstDate: string | null;
};

export type HoldingSnapshot = {
  id: number;
  label: string;
  kind: HoldingKind;
  accountId: number;
  accountName: string;
  accountColor: string;
  symbol: string | null;
  instrumentType: string | null;
  currency: string;
  quantity: number;
  /** PRU dans la devise de la ligne */
  avgCost: number | null;
  /** Dernier cours connu, dans la devise de la ligne */
  lastPrice: number | null;
  /** Taux devise → EUR appliqué */
  fxRate: number;
  /** Valeur actuelle en euros */
  value: number;
  costBasis: number;
  unrealizedPL: number;
  unrealizedPLPct: number | null;
  realizedPL: number;
  dividends: number;
  fees: number;
  /** Variation depuis la clôture de la veille, en euros */
  dayChange: number | null;
  dayChangePct: number | null;
  /** Part du patrimoine total, entre 0 et 1 */
  weight: number;
  /** Vraie si le cours n'a pas pu être rafraîchi */
  stale: boolean;
};

export type AccountSnapshot = {
  id: number;
  name: string;
  kind: string;
  institution: string | null;
  currency: string;
  color: string;
  value: number;
  costBasis: number;
  unrealizedPL: number;
  unrealizedPLPct: number | null;
  dayChange: number;
  dayChangePct: number | null;
  weight: number;
  holdings: HoldingSnapshot[];
};

export type PortfolioSnapshot = {
  totalValue: number;
  totalCostBasis: number;
  unrealizedPL: number;
  unrealizedPLPct: number | null;
  realizedPL: number;
  dividends: number;
  fees: number;
  dayChange: number;
  dayChangePct: number | null;
  accounts: AccountSnapshot[];
  /** Toutes les lignes, à plat, triées par valeur décroissante */
  holdings: HoldingSnapshot[];
  updatedAt: number;
};

/** Point de la courbe : timestamp epoch ms, valeur en euros */
export type SeriesPoint = { t: number; v: number };

export type HistorySeries = {
  range: Range;
  points: SeriesPoint[];
  startValue: number;
  endValue: number;
  /** Apports nets sur la période — retirés de la performance */
  netFlows: number;
  /** endValue − startValue − netFlows : la vraie performance */
  change: number;
  changePct: number | null;
  isIntraday: boolean;
};

/** Libellé long de chaque fenêtre, pour la phrase « … sur 1 mois ». */
export const RANGE_LABELS: Record<Range, string> = {
  "1J": "sur 24 heures",
  "7J": "sur 7 jours",
  "1M": "sur 1 mois",
  "3M": "sur 3 mois",
  "6M": "sur 6 mois",
  YTD: "depuis le 1er janvier",
  "1A": "sur 1 an",
  TOUT: "depuis l'origine",
};
