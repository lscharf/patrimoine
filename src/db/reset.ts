/**
 * Vide le portefeuille — `npm run db:reset`.
 * Le cache de cours et de taux de change est conservé : il se reconstruira de
 * toute façon, et le garder évite de retélécharger plusieurs années
 * d'historique au prochain lancement.
 */
import { db, sqlite } from "./index";
import { accounts, holdings, manualValues, transactions } from "./schema";

const KEEP_PRICES = !process.argv.includes("--purge-prices");

for (const table of [manualValues, transactions, holdings, accounts]) {
  db.delete(table).run();
}

if (!KEEP_PRICES) {
  const { fxBars, fxState, instruments, priceBars } = await import("./schema");
  for (const table of [priceBars, fxBars, fxState, instruments]) {
    db.delete(table).run();
  }
}

sqlite.close();
console.log(
  `✓ Portefeuille vidé.${KEEP_PRICES ? " Cache de cours conservé." : " Cache de cours purgé."}`,
);
