import { buildSnapshot } from "../src/server/portfolio/snapshot";
import { buildHistory } from "../src/server/portfolio/history";
import { sqlite } from "../src/db";

const t0 = Date.now();
const s = await buildSnapshot();
console.log(`SNAPSHOT (${Date.now() - t0} ms)`);
console.log(`  Total ................ ${s.totalValue.toFixed(2)} €`);
console.log(`  Prix de revient ...... ${s.totalCostBasis.toFixed(2)} €`);
console.log(`  +/- value latente .... ${s.unrealizedPL.toFixed(2)} € (${((s.unrealizedPLPct ?? 0) * 100).toFixed(2)} %)`);
console.log(`  Réalisé .............. ${s.realizedPL.toFixed(2)} €`);
console.log(`  Dividendes ........... ${s.dividends.toFixed(2)} €   Frais: ${s.fees.toFixed(2)} €`);
console.log(`  Variation du jour .... ${s.dayChange.toFixed(2)} € (${((s.dayChangePct ?? 0) * 100).toFixed(2)} %)`);
console.log("\n  LIGNES");
for (const h of s.holdings) {
  console.log(
    `   ${h.label.padEnd(20)} ${(h.symbol ?? "—").padEnd(9)} q=${String(h.quantity).padEnd(8)}` +
    ` pru=${h.avgCost ? h.avgCost.toFixed(2) : "—"} ${h.currency.padEnd(4)}` +
    ` val=${h.value.toFixed(0).padStart(7)} €  pl=${h.unrealizedPL.toFixed(0).padStart(6)} €` +
    ` (${h.unrealizedPLPct != null ? (h.unrealizedPLPct * 100).toFixed(1) + "%" : "—"})` +
    ` w=${(h.weight * 100).toFixed(1)}%`
  );
}
console.log("\n  COMPTES");
for (const a of s.accounts) console.log(`   ${a.name.padEnd(28)} ${a.value.toFixed(0).padStart(7)} €  ${(a.weight * 100).toFixed(1)}%`);

console.log("\nHISTORIQUE");
for (const r of ["1J", "7J", "1M", "3M", "6M", "YTD", "1A", "TOUT"] as const) {
  const t = Date.now();
  const h = await buildHistory(r, { liveTotal: s.totalValue });
  const d = Date.now() - t;
  const first = h.points[0], last = h.points.at(-1);
  console.log(
    `  ${r.padEnd(5)} ${String(h.points.length).padStart(4)} pts ${String(d).padStart(5)}ms` +
    ` | ${first ? new Date(first.t).toISOString().slice(0, 10) : "—"} → ${last ? new Date(last.t).toISOString().slice(0, 10) : "—"}` +
    ` | début ${h.startValue.toFixed(0).padStart(6)} € fin ${h.endValue.toFixed(0).padStart(6)} €` +
    ` | apports ${h.netFlows.toFixed(0).padStart(6)} €` +
    ` | perf ${h.change.toFixed(0).padStart(6)} € (${h.changePct != null ? (h.changePct * 100).toFixed(2) + "%" : "—"})`
  );
}
sqlite.close();
