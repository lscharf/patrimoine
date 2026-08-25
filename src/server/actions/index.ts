"use server";

import { revalidatePath } from "next/cache";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  accounts,
  holdings,
  instruments,
  manualValues,
  transactions,
} from "@/db/schema";
import { currentUserId } from "@/server/auth/session";
import {
  ownsAccount,
  ownsHolding,
  ownsManualValue,
  ownsTransaction,
} from "@/server/auth/ownership";
import { ensureInstrument } from "@/server/prices/cache";
import { yahooProvider } from "@/server/prices/yahoo";
import type { SearchHit } from "@/server/prices/provider";
import {
  accountInput,
  manualHoldingInput,
  manualValueInput,
  quotedHoldingInput,
  transactionInput,
} from "./schemas";

export type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? object : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fail(error: string, fieldErrors?: Record<string, string>) {
  return { ok: false as const, error, fieldErrors };
}

const UNAUTHORIZED = "Session expirée. Reconnectez-vous.";
/**
 * Message volontairement identique pour « n'existe pas » et « ne vous
 * appartient pas » : distinguer les deux permettrait d'énumérer les
 * identifiants d'autrui.
 */
const FORBIDDEN = "Cet élément est introuvable.";

function fromZod(err: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    fieldErrors[key] ??= issue.message;
  }
  return fail("Vérifiez les champs du formulaire.", fieldErrors);
}

function refresh() {
  revalidatePath("/", "layout");
}

function nextPosition(table: typeof accounts | typeof holdings) {
  const row = db
    .select({ max: sql<number | null>`max(position)` })
    .from(table)
    .get();
  return (row?.max ?? -1) + 1;
}

/* ------------------------------------------------------------------ *
 * Recherche d'instrument
 * ------------------------------------------------------------------ */

export async function searchInstruments(
  query: string,
): Promise<ActionResult<SearchHit[]>> {
  const userId = await currentUserId();
  if (!userId) return fail(UNAUTHORIZED);

  const q = query.trim();
  if (q.length < 2) return { ok: true, data: [] };

  try {
    const results = await yahooProvider.search(q);

    // Une saisie qui ressemble à un ticker (CW8.PA, BTC-EUR) n'est pas
    // toujours bien classée par la recherche plein texte : on tente aussi
    // la résolution directe et on la place en tête.
    if (/^[A-Za-z0-9.\-^=]{1,15}$/.test(q)) {
      const already = results.some(
        (r) => r.symbol.toUpperCase() === q.toUpperCase(),
      );
      if (!already) {
        try {
          const [exact] = await yahooProvider.quotes([q.toUpperCase()]);
          if (exact) {
            results.unshift({
              symbol: exact.symbol,
              name: exact.name,
              type: exact.type,
              currency: exact.currency,
              exchange: exact.exchange,
            });
          }
        } catch {
          // Pas un symbole valide : la recherche plein texte suffit.
        }
      }
    }
    return { ok: true, data: results.slice(0, 12) };
  } catch {
    return fail("La recherche est momentanément indisponible.");
  }
}

/* ------------------------------------------------------------------ *
 * Comptes
 * ------------------------------------------------------------------ */

const PALETTE = [
  "#7C5CFF",
  "#4C8DFF",
  "#2ED3A7",
  "#F2A33C",
  "#FF6FA5",
  "#38BDF8",
  "#C084FC",
  "#8B93A7",
];

export async function createAccount(raw: unknown): Promise<ActionResult<number>> {
  const userId = await currentUserId();
  if (!userId) return fail(UNAUTHORIZED);

  const parsed = accountInput.safeParse(raw);
  if (!parsed.success) return fromZod(parsed.error);
  const { name, kind, institution, color } = parsed.data;

  const position = nextPosition(accounts);
  db.insert(accounts)
    .values({
      userId,
      name,
      kind,
      institution: institution || null,
      color: color || PALETTE[position % PALETTE.length],
      position,
    })
    .run();

  const created = db
    .select({ id: accounts.id })
    .from(accounts)
    .orderBy(desc(accounts.id))
    .limit(1)
    .get()!;
  refresh();
  return { ok: true, data: created.id };
}

export async function updateAccount(
  id: number,
  raw: unknown,
): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return fail(UNAUTHORIZED);
  if (!ownsAccount(userId, id)) return fail(FORBIDDEN);

  const parsed = accountInput.partial().safeParse(raw);
  if (!parsed.success) return fromZod(parsed.error);
  const { name, kind, institution, color } = parsed.data;

  db.update(accounts)
    .set({
      ...(name != null && { name }),
      ...(kind != null && { kind }),
      ...(institution !== undefined && { institution: institution || null }),
      ...(color != null && { color }),
    })
    .where(eq(accounts.id, id))
    .run();
  refresh();
  return { ok: true };
}

export async function deleteAccount(id: number): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return fail(UNAUTHORIZED);
  if (!ownsAccount(userId, id)) return fail(FORBIDDEN);

  // Les lignes et transactions partent en cascade (ON DELETE CASCADE).
  db.delete(accounts).where(eq(accounts.id, id)).run();
  refresh();
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Lignes
 * ------------------------------------------------------------------ */

export async function createQuotedHolding(
  raw: unknown,
): Promise<ActionResult<number>> {
  const userId = await currentUserId();
  if (!userId) return fail(UNAUTHORIZED);

  const parsed = quotedHoldingInput.safeParse(raw);
  if (!parsed.success) return fromZod(parsed.error);
  const { accountId, symbol, label, date, quantity, unitPrice, fees } =
    parsed.data;

  if (!ownsAccount(userId, accountId)) return fail(FORBIDDEN);

  let instrument;
  try {
    instrument = await ensureInstrument(symbol);
  } catch {
    return fail(`Le symbole « ${symbol} » est introuvable.`, {
      symbol: "Symbole inconnu",
    });
  }

  const position = nextPosition(holdings);
  db.insert(holdings)
    .values({
      accountId,
      instrumentId: instrument.id,
      label: label || instrument.name,
      kind: "QUOTED",
      currency: instrument.currency,
      position,
    })
    .run();

  const holding = db
    .select({ id: holdings.id })
    .from(holdings)
    .orderBy(desc(holdings.id))
    .limit(1)
    .get()!;

  db.insert(transactions)
    .values({
      holdingId: holding.id,
      type: "BUY",
      date,
      quantity,
      unitPrice,
      fees: fees ?? 0,
    })
    .run();

  refresh();
  return { ok: true, data: holding.id };
}

export async function createManualHolding(
  raw: unknown,
): Promise<ActionResult<number>> {
  const userId = await currentUserId();
  if (!userId) return fail(UNAUTHORIZED);

  const parsed = manualHoldingInput.safeParse(raw);
  if (!parsed.success) return fromZod(parsed.error);
  const { accountId, label, date, amount, value } = parsed.data;

  if (!ownsAccount(userId, accountId)) return fail(FORBIDDEN);

  const position = nextPosition(holdings);
  db.insert(holdings)
    .values({ accountId, label, kind: "MANUAL", currency: "EUR", position })
    .run();

  const holding = db
    .select({ id: holdings.id })
    .from(holdings)
    .orderBy(desc(holdings.id))
    .limit(1)
    .get()!;

  if (amount > 0) {
    db.insert(transactions)
      .values({ holdingId: holding.id, type: "DEPOSIT", date, amount })
      .run();
  }
  db.insert(manualValues)
    .values({ holdingId: holding.id, date, value: value ?? amount })
    .run();

  refresh();
  return { ok: true, data: holding.id };
}

export async function updateHolding(
  id: number,
  raw: unknown,
): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return fail(UNAUTHORIZED);
  if (!ownsHolding(userId, id)) return fail(FORBIDDEN);

  const parsed = z
    .object({
      label: z.string().trim().min(1).max(80).optional(),
      note: z.string().trim().max(500).optional().or(z.literal("")),
    })
    .safeParse(raw);
  if (!parsed.success) return fromZod(parsed.error);

  db.update(holdings)
    .set({
      ...(parsed.data.label != null && { label: parsed.data.label }),
      ...(parsed.data.note !== undefined && { note: parsed.data.note || null }),
    })
    .where(eq(holdings.id, id))
    .run();
  refresh();
  return { ok: true };
}

export async function deleteHolding(id: number): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return fail(UNAUTHORIZED);
  if (!ownsHolding(userId, id)) return fail(FORBIDDEN);

  db.delete(holdings).where(eq(holdings.id, id)).run();
  refresh();
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Transactions
 * ------------------------------------------------------------------ */

export async function addTransaction(raw: unknown): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return fail(UNAUTHORIZED);

  const parsed = transactionInput.safeParse(raw);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  if (!ownsHolding(userId, v.holdingId)) return fail(FORBIDDEN);

  db.insert(transactions)
    .values({
      holdingId: v.holdingId,
      type: v.type,
      date: v.date,
      quantity: v.quantity ?? 0,
      unitPrice: v.unitPrice ?? 0,
      fees: v.fees ?? 0,
      amount: v.amount ?? 0,
      note: v.note || null,
    })
    .run();

  refresh();
  return { ok: true };
}

export async function updateTransaction(
  id: number,
  raw: unknown,
): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return fail(UNAUTHORIZED);
  if (!ownsTransaction(userId, id)) return fail(FORBIDDEN);

  const parsed = transactionInput.safeParse(raw);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  db.update(transactions)
    .set({
      type: v.type,
      date: v.date,
      quantity: v.quantity ?? 0,
      unitPrice: v.unitPrice ?? 0,
      fees: v.fees ?? 0,
      amount: v.amount ?? 0,
      note: v.note || null,
    })
    .where(eq(transactions.id, id))
    .run();

  refresh();
  return { ok: true };
}

export async function deleteTransaction(id: number): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return fail(UNAUTHORIZED);
  if (!ownsTransaction(userId, id)) return fail(FORBIDDEN);

  db.delete(transactions).where(eq(transactions.id, id)).run();
  refresh();
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Valorisations manuelles
 * ------------------------------------------------------------------ */

export async function setManualValue(raw: unknown): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return fail(UNAUTHORIZED);

  const parsed = manualValueInput.safeParse(raw);
  if (!parsed.success) return fromZod(parsed.error);
  const { holdingId, date, value } = parsed.data;

  if (!ownsHolding(userId, holdingId)) return fail(FORBIDDEN);

  db.insert(manualValues)
    .values({ holdingId, date, value })
    .onConflictDoUpdate({
      target: [manualValues.holdingId, manualValues.date],
      set: { value },
    })
    .run();

  refresh();
  return { ok: true };
}

export async function deleteManualValue(id: number): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return fail(UNAUTHORIZED);
  if (!ownsManualValue(userId, id)) return fail(FORBIDDEN);

  db.delete(manualValues).where(eq(manualValues.id, id)).run();
  refresh();
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Divers
 * ------------------------------------------------------------------ */

/** Force le rafraîchissement des cours au prochain rendu. */
export async function invalidateQuotes(): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return fail(UNAUTHORIZED);

  db.update(instruments).set({ lastPriceAt: 0 }).run();
  refresh();
  return { ok: true };
}
