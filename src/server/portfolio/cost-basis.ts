import type { Transaction } from "@/db/schema";
import type { CostBasis } from "./types";

/**
 * Parcourt les transactions d'une ligne pour en déduire quantité, prix de
 * revient, plus-value réalisée, dividendes et frais.
 *
 * Méthode du **prix moyen pondéré** (PRU) : c'est la règle appliquée en France
 * pour le PEA comme pour le compte-titres, et elle évite d'avoir à suivre
 * chaque lot individuellement.
 *
 * Le prix de revient est tenu en double : dans la devise de la ligne (pour
 * afficher un PRU comparable au cours) et en euros converti **au taux du jour
 * de chaque transaction**. Cette seconde version fait apparaître l'effet de
 * change comme une composante réelle de la performance.
 *
 * @param fxOn  taux devise → EUR à une date donnée ; doit toujours renvoyer
 *              une valeur exploitable (repli sur le taux courant).
 */
export function computeCostBasis(
  txs: Transaction[],
  fxOn: (date: string) => number,
): CostBasis {
  const ordered = [...txs].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
  );

  let quantity = 0;
  let costLocal = 0;
  let costEur = 0;
  let realized = 0;
  let dividends = 0;
  let fees = 0;
  let invested = 0;

  for (const tx of ordered) {
    const fx = fxOn(tx.date);

    switch (tx.type) {
      case "BUY": {
        const gross = tx.quantity * tx.unitPrice + tx.fees;
        quantity += tx.quantity;
        costLocal += gross;
        costEur += gross * fx;
        fees += tx.fees * fx;
        invested += gross * fx;
        break;
      }

      case "SELL": {
        const proceeds = tx.quantity * tx.unitPrice - tx.fees;
        if (quantity > 0) {
          // Fraction du prix de revient sortie du portefeuille. On plafonne à
          // 1 : vendre plus que détenu ne doit pas créer de coût négatif.
          const share = Math.min(tx.quantity / quantity, 1);
          const removedEur = costEur * share;
          costLocal -= costLocal * share;
          costEur -= removedEur;
          realized += proceeds * fx - removedEur;
        } else {
          realized += proceeds * fx;
        }
        quantity = Math.max(0, quantity - tx.quantity);
        fees += tx.fees * fx;
        invested -= proceeds * fx;
        break;
      }

      case "DIVIDEND":
        dividends += tx.amount * fx;
        break;

      case "FEE":
        fees += tx.amount * fx;
        break;

      // Lignes non cotées (PEE, Livret A) : le versement *est* le coût.
      case "DEPOSIT":
        costLocal += tx.amount;
        costEur += tx.amount * fx;
        invested += tx.amount * fx;
        break;

      case "WITHDRAWAL":
        costLocal -= tx.amount;
        costEur -= tx.amount * fx;
        invested -= tx.amount * fx;
        break;
    }
  }

  // Le bruit d'arrondi en virgule flottante peut laisser des résidus
  // microscopiques après une vente totale.
  if (Math.abs(quantity) < 1e-10) quantity = 0;
  if (Math.abs(costLocal) < 1e-6) costLocal = 0;
  if (Math.abs(costEur) < 1e-6) costEur = 0;

  return {
    quantity,
    costLocal,
    costEur,
    avgCost: quantity > 0 ? costLocal / quantity : null,
    realized,
    dividends,
    fees,
    invested,
    firstDate: ordered[0]?.date ?? null,
  };
}

/**
 * Quantité détenue à une date donnée (incluse). Utilisé pour reconstruire
 * le portefeuille jour après jour.
 */
export function quantityTimeline(
  txs: Transaction[],
  dates: string[],
): Float64Array {
  const ordered = [...txs].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
  );
  const out = new Float64Array(dates.length);
  let qty = 0;
  let i = 0;

  for (let d = 0; d < dates.length; d++) {
    while (i < ordered.length && ordered[i].date <= dates[d]) {
      const tx = ordered[i];
      if (tx.type === "BUY") qty += tx.quantity;
      else if (tx.type === "SELL") qty = Math.max(0, qty - tx.quantity);
      i++;
    }
    out[d] = qty;
  }
  return out;
}

/** Flux net (apports − retraits) en euros sur ]from, to] */
export function netFlowsBetween(
  txs: Transaction[],
  from: string,
  to: string,
  fxOn: (date: string) => number,
): number {
  let net = 0;
  for (const tx of txs) {
    if (tx.date <= from || tx.date > to) continue;
    const fx = fxOn(tx.date);
    switch (tx.type) {
      case "BUY":
        net += (tx.quantity * tx.unitPrice + tx.fees) * fx;
        break;
      case "SELL":
        net -= (tx.quantity * tx.unitPrice - tx.fees) * fx;
        break;
      case "DEPOSIT":
        net += tx.amount * fx;
        break;
      case "WITHDRAWAL":
        net -= tx.amount * fx;
        break;
      // Dividendes et frais ne sont pas des apports : ils font partie de
      // la performance, pas du capital investi.
    }
  }
  return net;
}
