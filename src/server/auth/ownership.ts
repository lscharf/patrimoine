import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, holdings, loans, manualValues, transactions } from "@/db/schema";

/**
 * Contrôles de propriété.
 *
 * Toute la hiérarchie du portefeuille descend du compte : ligne → compte,
 * transaction → ligne → compte. Vérifier le propriétaire du compte suffit donc
 * à couvrir l'ensemble, à condition de remonter la chaîne à chaque fois — ce
 * que font les jointures ci-dessous.
 *
 * Ces fonctions sont appelées par **chaque** mutation avant d'écrire. Un seul
 * oubli sur une suppression permettrait à un utilisateur d'effacer les données
 * d'un autre en devinant un identifiant numérique.
 */

export function ownsAccount(userId: string, accountId: number): boolean {
  return (
    db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
      .get() != null
  );
}

export function ownsHolding(userId: string, holdingId: number): boolean {
  return (
    db
      .select({ id: holdings.id })
      .from(holdings)
      .innerJoin(accounts, eq(holdings.accountId, accounts.id))
      .where(and(eq(holdings.id, holdingId), eq(accounts.userId, userId)))
      .get() != null
  );
}

export function ownsTransaction(userId: string, transactionId: number): boolean {
  return (
    db
      .select({ id: transactions.id })
      .from(transactions)
      .innerJoin(holdings, eq(transactions.holdingId, holdings.id))
      .innerJoin(accounts, eq(holdings.accountId, accounts.id))
      .where(and(eq(transactions.id, transactionId), eq(accounts.userId, userId)))
      .get() != null
  );
}

export function ownsManualValue(userId: string, valueId: number): boolean {
  return (
    db
      .select({ id: manualValues.id })
      .from(manualValues)
      .innerJoin(holdings, eq(manualValues.holdingId, holdings.id))
      .innerJoin(accounts, eq(holdings.accountId, accounts.id))
      .where(and(eq(manualValues.id, valueId), eq(accounts.userId, userId)))
      .get() != null
  );
}

export function ownsLoan(userId: string, loanId: number): boolean {
  return (
    db
      .select({ id: loans.id })
      .from(loans)
      .where(and(eq(loans.id, loanId), eq(loans.userId, userId)))
      .get() != null
  );
}
