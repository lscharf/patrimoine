/**
 * Jeu de démonstration — `npm run seed`.
 * Couvre volontairement tous les cas limites du moteur : achats échelonnés
 * (DCA), vente partielle, ligne en dollars, crypto, dividendes, frais, et
 * lignes non cotées valorisées à la main.
 *
 * `npm run seed -- --reset` vide la base au préalable.
 */
import { db, sqlite } from "./index";
import {
  accounts,
  holdings,
  manualValues,
  transactions,
  instruments,
  priceBars,
  fxBars,
  fxState,
} from "./schema";
import { ensureInstrument } from "@/server/prices/cache";

type TxSeed = {
  type: "BUY" | "SELL" | "DIVIDEND" | "FEE" | "DEPOSIT" | "WITHDRAWAL";
  date: string;
  quantity?: number;
  unitPrice?: number;
  fees?: number;
  amount?: number;
};

const RESET = process.argv.includes("--reset");

async function main() {
  if (RESET) {
    for (const t of [
      manualValues,
      transactions,
      holdings,
      accounts,
      priceBars,
      fxBars,
      fxState,
      instruments,
    ]) {
      db.delete(t).run();
    }
    console.log("· base vidée");
  }

  if (db.select().from(accounts).all().length > 0) {
    console.log("La base contient déjà des données — relancez avec --reset.");
    return;
  }

  const mkAccount = (
    name: string,
    kind: string,
    institution: string,
    color: string,
    position: number,
  ) => {
    db.insert(accounts)
      .values({ name, kind, institution, color, position })
      .run();
    return db.select().from(accounts).all().at(-1)!;
  };

  const mkQuoted = async (
    accountId: number,
    symbol: string,
    label: string,
    txs: TxSeed[],
  ) => {
    const instrument = await ensureInstrument(symbol);
    db.insert(holdings)
      .values({
        accountId,
        instrumentId: instrument.id,
        label,
        kind: "QUOTED",
        currency: instrument.currency,
      })
      .run();
    const holding = db.select().from(holdings).all().at(-1)!;
    for (const t of txs) {
      db.insert(transactions)
        .values({
          holdingId: holding.id,
          type: t.type,
          date: t.date,
          quantity: t.quantity ?? 0,
          unitPrice: t.unitPrice ?? 0,
          fees: t.fees ?? 0,
          amount: t.amount ?? 0,
        })
        .run();
    }
    console.log(`  ✓ ${label.padEnd(30)} ${symbol} (${instrument.currency})`);
    return holding;
  };

  const mkManual = (
    accountId: number,
    label: string,
    txs: TxSeed[],
    valuations: { date: string; value: number }[],
  ) => {
    db.insert(holdings)
      .values({ accountId, label, kind: "MANUAL", currency: "EUR" })
      .run();
    const holding = db.select().from(holdings).all().at(-1)!;
    for (const t of txs) {
      db.insert(transactions)
        .values({
          holdingId: holding.id,
          type: t.type,
          date: t.date,
          amount: t.amount ?? 0,
        })
        .run();
    }
    for (const v of valuations) {
      db.insert(manualValues)
        .values({ holdingId: holding.id, date: v.date, value: v.value })
        .run();
    }
    console.log(`  ✓ ${label.padEnd(30)} (non coté)`);
    return holding;
  };

  // ---- PEA : achats programmés + une vente partielle -------------------
  const pea = mkAccount("PEA", "PEA", "BoursoBank", "#7C5CFF", 0);
  console.log("PEA");
  await mkQuoted(pea.id, "CW8.PA", "Amundi MSCI World", [
    { type: "BUY", date: "2024-02-15", quantity: 6, unitPrice: 452.3, fees: 2.5 },
    { type: "BUY", date: "2024-08-12", quantity: 4, unitPrice: 501.8, fees: 2.5 },
    { type: "BUY", date: "2025-03-03", quantity: 3, unitPrice: 548.4, fees: 2.5 },
    { type: "BUY", date: "2025-11-17", quantity: 2, unitPrice: 631.0, fees: 2.5 },
  ]);
  await mkQuoted(pea.id, "PE500.PA", "Amundi PEA S&P 500", [
    { type: "BUY", date: "2024-05-06", quantity: 80, unitPrice: 32.1, fees: 2.5 },
    { type: "BUY", date: "2025-01-20", quantity: 45, unitPrice: 41.75, fees: 2.5 },
    { type: "SELL", date: "2025-09-08", quantity: 25, unitPrice: 49.2, fees: 2.5 },
  ]);

  // ---- CTO : ligne en dollars + dividendes ----------------------------
  const cto = mkAccount("Compte-titres", "CTO", "Trade Republic", "#4C8DFF", 1);
  console.log("Compte-titres");
  await mkQuoted(cto.id, "AAPL", "Apple", [
    { type: "BUY", date: "2024-06-11", quantity: 12, unitPrice: 207.15, fees: 1 },
    { type: "DIVIDEND", date: "2024-11-14", amount: 3.0 },
    { type: "DIVIDEND", date: "2025-05-15", amount: 3.12 },
    { type: "DIVIDEND", date: "2025-11-13", amount: 3.24 },
  ]);
  await mkQuoted(cto.id, "MC.PA", "LVMH", [
    { type: "BUY", date: "2025-04-09", quantity: 4, unitPrice: 512.0, fees: 1 },
    { type: "DIVIDEND", date: "2025-12-04", amount: 52.0 },
  ]);

  // ---- Crypto ---------------------------------------------------------
  const crypto = mkAccount("Trezor", "CRYPTO", "Cold wallet", "#F2A33C", 2);
  console.log("Trezor");
  await mkQuoted(crypto.id, "BTC-EUR", "Bitcoin", [
    { type: "BUY", date: "2024-03-22", quantity: 0.045, unitPrice: 58900 },
    { type: "BUY", date: "2025-06-30", quantity: 0.031, unitPrice: 91200 },
  ]);
  await mkQuoted(crypto.id, "ETH-EUR", "Ethereum", [
    { type: "BUY", date: "2024-09-02", quantity: 0.9, unitPrice: 2180 },
  ]);
  await mkQuoted(crypto.id, "SOL-EUR", "Solana", [
    { type: "BUY", date: "2025-02-14", quantity: 4.2, unitPrice: 142.5 },
  ]);

  // ---- Non coté -------------------------------------------------------
  const pee = mkAccount("Plan d'Épargne Entreprise", "PEE", "Natixis Interépargne", "#2ED3A7", 3);
  console.log("Épargne salariale & livrets");
  mkManual(
    pee.id,
    "Fonds diversifié",
    [
      { type: "DEPOSIT", date: "2024-04-30", amount: 2400 },
      { type: "DEPOSIT", date: "2025-04-30", amount: 2800 },
      { type: "DEPOSIT", date: "2026-04-30", amount: 3100 },
    ],
    [
      { date: "2024-12-31", value: 2530 },
      { date: "2025-06-30", value: 5460 },
      { date: "2025-12-31", value: 5890 },
      { date: "2026-06-30", value: 9310 },
    ],
  );

  const livret = mkAccount("Livret A", "LIVRET", "BNP Paribas", "#8B93A7", 4);
  mkManual(
    livret.id,
    "Livret A",
    [
      { type: "DEPOSIT", date: "2024-01-05", amount: 4000 },
      { type: "DEPOSIT", date: "2025-07-01", amount: 1500 },
    ],
    [
      { date: "2024-12-31", value: 4120 },
      { date: "2025-12-31", value: 5738 },
    ],
  );

  console.log("\n✓ Jeu de démonstration installé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sqlite.close());
