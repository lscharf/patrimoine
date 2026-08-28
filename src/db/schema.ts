import { sql } from "drizzle-orm";
import { authUser } from "./auth-schema";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/* ------------------------------------------------------------------ *
 * Comptes — "PEA", "Trezor", "Plan d'Épargne Entreprise"...
 * ------------------------------------------------------------------ */
export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /**
   * Propriétaire du compte. Nullable au niveau SQL uniquement pour permettre
   * la migration des portefeuilles créés avant l'authentification : ils sont
   * rattachés au premier utilisateur qui se connecte. En lecture, toutes les
   * requêtes filtrent strictement sur l'utilisateur de la session — une ligne
   * orpheline n'est donc jamais visible.
   */
  userId: text("user_id").references(() => authUser.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  /** PEA | CTO | PEE | AV | LIVRET | CRYPTO | OTHER */
  kind: text("kind").notNull().default("CTO"),
  institution: text("institution"),
  currency: text("currency").notNull().default("EUR"),
  /** Accent hex utilisé dans les graphiques et la pastille du compte */
  color: text("color").notNull().default("#7c5cff"),
  position: integer("position").notNull().default(0),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/* ------------------------------------------------------------------ *
 * Instruments cotés — mutualisés entre tous les comptes
 * ------------------------------------------------------------------ */
export const instruments = sqliteTable(
  "instruments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Ticker Yahoo : CW8.PA, BTC-EUR, AAPL */
    symbol: text("symbol").notNull(),
    name: text("name").notNull(),
    /** ETF | EQUITY | CRYPTOCURRENCY | MUTUALFUND | INDEX */
    type: text("type").notNull().default("EQUITY"),
    /** Devise de cotation */
    currency: text("currency").notNull().default("EUR"),
    exchange: text("exchange"),

    // --- cache de cotation temps réel ---
    lastPrice: real("last_price"),
    prevClose: real("prev_close"),
    lastPriceAt: integer("last_price_at"),
    /** Dernière date couverte par le cache d'historique (YYYY-MM-DD) */
    historyThrough: text("history_through"),
    /**
     * Dernière **tentative** de complétion de l'historique, epoch ms.
     *
     * Distinct de `historyThrough` : une place peut n'avoir rien publié de
     * nouveau depuis vendredi. Sans cette date, on la resolliciterait à
     * chaque affichage sans jamais rien obtenir de plus.
     */
    historyCheckedAt: integer("history_checked_at"),
    /**
     * Date la plus ancienne déjà **demandée** au fournisseur (YYYY-MM-DD).
     *
     * Distincte de la plus ancienne barre reçue : si l'on réclame 2020 et que
     * le fournisseur ne remonte qu'à 2021, l'écart persiste indéfiniment. Sans
     * cette borne, on redemanderait la même chose à chaque affichage.
     */
    historyFrom: text("history_from"),

    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("instruments_symbol_unique").on(t.symbol)],
);

/* ------------------------------------------------------------------ *
 * Lignes — "ETF SP500" à l'intérieur d'un compte
 * ------------------------------------------------------------------ */
export const holdings = sqliteTable(
  "holdings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    /** null pour les lignes non cotées (PEE, Livret A, parts sociales) */
    instrumentId: integer("instrument_id").references(() => instruments.id, {
      onDelete: "set null",
    }),
    label: text("label").notNull(),
    /** QUOTED = valorisée par cours de marché | MANUAL = valorisation saisie */
    kind: text("kind").notNull().default("QUOTED"),
    /** Devise de la ligne (= devise de cotation pour QUOTED) */
    currency: text("currency").notNull().default("EUR"),
    note: text("note"),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("holdings_account_idx").on(t.accountId)],
);

/* ------------------------------------------------------------------ *
 * Transactions — une ligne en porte plusieurs (DCA, ventes, dividendes)
 * ------------------------------------------------------------------ */
export const transactions = sqliteTable(
  "transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    holdingId: integer("holding_id")
      .notNull()
      .references(() => holdings.id, { onDelete: "cascade" }),
    /** BUY | SELL | DIVIDEND | FEE | DEPOSIT | WITHDRAWAL */
    type: text("type").notNull(),
    /** YYYY-MM-DD */
    date: text("date").notNull(),
    /** Titres — BUY/SELL uniquement */
    quantity: real("quantity").notNull().default(0),
    /** Prix unitaire dans la devise de la ligne — BUY/SELL uniquement */
    unitPrice: real("unit_price").notNull().default(0),
    /** Frais de courtage, toujours un coût */
    fees: real("fees").notNull().default(0),
    /** Montant en cash — DIVIDEND | FEE | DEPOSIT | WITHDRAWAL */
    amount: real("amount").notNull().default(0),
    note: text("note"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("transactions_holding_idx").on(t.holdingId),
    index("transactions_date_idx").on(t.date),
  ],
);

/* ------------------------------------------------------------------ *
 * Valorisations manuelles — PEE, Livret A, parts sociales
 * ------------------------------------------------------------------ */
export const manualValues = sqliteTable(
  "manual_values",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    holdingId: integer("holding_id")
      .notNull()
      .references(() => holdings.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    value: real("value").notNull(),
  },
  (t) => [uniqueIndex("manual_values_unique").on(t.holdingId, t.date)],
);

/* ------------------------------------------------------------------ *
 * Cache d'historique de cours — moteur de la courbe patrimoine
 * ------------------------------------------------------------------ */
export const priceBars = sqliteTable(
  "price_bars",
  {
    instrumentId: integer("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    close: real("close").notNull(),
  },
  (t) => [primaryKey({ columns: [t.instrumentId, t.date] })],
);

/* ------------------------------------------------------------------ *
 * Cache des taux de change — "USDEUR", "CHFEUR"...
 * ------------------------------------------------------------------ */
export const fxBars = sqliteTable(
  "fx_bars",
  {
    pair: text("pair").notNull(),
    date: text("date").notNull(),
    rate: real("rate").notNull(),
  },
  (t) => [primaryKey({ columns: [t.pair, t.date] })],
);

export const fxState = sqliteTable("fx_state", {
  pair: text("pair").primaryKey(),
  rate: real("rate").notNull(),
  /** Dernier rafraîchissement du taux courant, epoch ms */
  updatedAt: integer("updated_at").notNull(),
  historyThrough: text("history_through"),
  /** Dernière tentative de complétion de l'historique — voir `instruments` */
  historyCheckedAt: integer("history_checked_at"),
  /** Date la plus ancienne déjà demandée — voir `instruments` */
  historyFrom: text("history_from"),
});

/* ------------------------------------------------------------------ *
 * Emprunts & Passif — "Prêt Immobilier", "Prêt Conso", "PTZ"...
 * ------------------------------------------------------------------ */
export const loans = sqliteTable(
  "loans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").references(() => authUser.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    /** AMORTIZING | IN_FINE | PTZ | OTHER */
    type: text("type").notNull().default("AMORTIZING"),
    /** Capital initial emprunté */
    borrowedAmount: real("borrowed_amount").notNull(),
    /** Apport personnel initial (optionnel) */
    downPayment: real("down_payment").notNull().default(0),
    /** Frais de dossier / garantie initiaux (optionnel) */
    initialFees: real("initial_fees").notNull().default(0),
    /** Taux d'intérêt annuel en pourcentage (ex: 4.07 pour 4.07%) */
    interestRate: real("interest_rate").notNull().default(0),
    /** Taux d'assurance annuel en pourcentage (ex: 0.36 pour 0.36%) */
    insuranceRate: real("insurance_rate").notNull().default(0),
    /** Durée totale en mois (ex: 108 pour 9 ans) */
    durationMonths: integer("duration_months").notNull(),
    /** Date de première échéance / début (YYYY-MM-DD) */
    startDate: text("start_date").notNull(),
    /** Mensualité personnalisée facultative (calculée si non renseignée) */
    customMonthlyPayment: real("custom_monthly_payment"),
    /** Compte ou ligne d'actif lié(e) (optionnel) */
    accountId: integer("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    holdingId: integer("holding_id").references(() => holdings.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("loans_user_idx").on(t.userId)],
);

export {
  authUser,
  authSession,
  authAccount,
  authVerification,
  type AuthUser,
} from "./auth-schema";

export type Account = typeof accounts.$inferSelect;
export type Instrument = typeof instruments.$inferSelect;
export type Holding = typeof holdings.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type ManualValue = typeof manualValues.$inferSelect;
export type Loan = typeof loans.$inferSelect;
