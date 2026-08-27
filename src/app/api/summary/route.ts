import { NextResponse, type NextRequest } from "next/server";
import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { accounts, authUser } from "@/db/schema";
import { getSession } from "@/server/auth/session";
import { buildSnapshot } from "@/server/portfolio/snapshot";
import { buildHistory } from "@/server/portfolio/history";
import { parseRange } from "@/lib/range";

export const dynamic = "force-dynamic";

/**
 * Point d'accès synthétique pour les widgets, barres d'état et intégrations externes.
 *
 * Paramètres query :
 * - `range` ou `p` : Fenêtre temporelle ("1J", "7J", "1M", "3M", "6M", "YTD", "1A", "TOUT"). Par défaut "1M".
 *
 * Authentification supportée :
 * 1. Cookie de session web Better Auth
 * 2. Header `Authorization: Bearer <PATRIMOINE_API_TOKEN>`
 * 3. Header `X-API-Key: <PATRIMOINE_API_TOKEN>`
 * 4. Paramètre URL `?token=<PATRIMOINE_API_TOKEN>`
 */
export async function GET(request: NextRequest) {
  // 1. Vérifier si une session utilisateur active existe
  const session = await getSession();
  let userId: string | null = session?.user?.id ?? null;

  // 2. Si pas de session web, valider le jeton API
  if (!userId) {
    const configuredToken = process.env.PATRIMOINE_API_TOKEN?.trim();
    const authHeader = request.headers.get("authorization");
    const apiKeyHeader = request.headers.get("x-api-key");
    const urlToken = request.nextUrl.searchParams.get("token");

    let bearerToken: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      bearerToken = authHeader.slice(7).trim();
    }

    const providedToken =
      bearerToken ?? apiKeyHeader?.trim() ?? urlToken?.trim();

    if (configuredToken) {
      if (!providedToken || providedToken !== configuredToken) {
        return NextResponse.json(
          { error: "Non autorisé : jeton API absent ou invalide" },
          { status: 401 },
        );
      }
    } else {
      // En production, refuser si aucun token n'a été défini
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "Accès API non configuré (PATRIMOINE_API_TOKEN manquant)" },
          { status: 401 },
        );
      }
    }

    // Résoudre l'utilisateur cible pour le snapshot
    const targetEmail = process.env.PATRIMOINE_API_USER_EMAIL?.trim().toLowerCase();
    if (targetEmail) {
      const user = db
        .select({ id: authUser.id })
        .from(authUser)
        .where(eq(authUser.email, targetEmail))
        .get();
      userId = user?.id ?? null;
    } else {
      const accountOwner = db
        .select({ userId: accounts.userId })
        .from(accounts)
        .where(isNotNull(accounts.userId))
        .get();
      const firstUser = db.select({ id: authUser.id }).from(authUser).get();
      userId = accountOwner?.userId ?? firstUser?.id ?? null;
    }
  }

  if (!userId) {
    return NextResponse.json(
      { error: "Aucun portefeuille trouvé" },
      { status: 404 },
    );
  }

  try {
    const range = parseRange(
      request.nextUrl.searchParams.get("range") ??
        request.nextUrl.searchParams.get("p") ??
        undefined,
    );

    const snapshot = await buildSnapshot(userId);

    const history = await buildHistory(range, {
      userId,
      liveTotal: snapshot.totalValue,
      liveValues: new Map(snapshot.holdings.map((h) => [h.id, h.value])),
    });

    return NextResponse.json({
      totalValue: snapshot.totalValue,
      totalCostBasis: snapshot.totalCostBasis,
      unrealizedPL: snapshot.unrealizedPL,
      unrealizedPLPct: snapshot.unrealizedPLPct,
      realizedPL: snapshot.realizedPL,
      dividends: snapshot.dividends,
      fees: snapshot.fees,
      dayChange: snapshot.dayChange,
      dayChangePct: snapshot.dayChangePct,
      history: {
        range: history.range,
        startValue: history.startValue,
        endValue: history.endValue,
        netFlows: history.netFlows,
        change: history.change,
        changePct: history.changePct,
        isIntraday: history.isIntraday,
      },
      accounts: snapshot.accounts.map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        institution: a.institution,
        currency: a.currency,
        color: a.color,
        value: a.value,
        costBasis: a.costBasis,
        unrealizedPL: a.unrealizedPL,
        unrealizedPLPct: a.unrealizedPLPct,
        dayChange: a.dayChange,
        dayChangePct: a.dayChangePct,
        weight: a.weight,
        holdingsCount: a.holdings.length,
      })),
      holdings: snapshot.holdings.map((h) => ({
        id: h.id,
        label: h.label,
        kind: h.kind,
        accountId: h.accountId,
        accountName: h.accountName,
        accountColor: h.accountColor,
        symbol: h.symbol,
        quantity: h.quantity,
        value: h.value,
        costBasis: h.costBasis,
        unrealizedPL: h.unrealizedPL,
        unrealizedPLPct: h.unrealizedPLPct,
        dayChange: h.dayChange,
        dayChangePct: h.dayChangePct,
        weight: h.weight,
        stale: h.stale,
      })),
      updatedAt: snapshot.updatedAt,
    });
  } catch (err) {
    console.error("[api/summary] Erreur lors de la génération du snapshot :", err);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 },
    );
  }
}
