import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Contrôle **optimiste** : le middleware s'exécute sur le runtime Edge et ne
 * peut pas interroger SQLite, il se contente donc de vérifier la présence du
 * cookie de session. Il évite un aller-retour inutile vers une page protégée,
 * mais ne constitue pas la barrière de sécurité.
 *
 * L'application est réellement protégée par `requireUserId()` dans les
 * requêtes de lecture et par les gardes de chaque server action, qui valident
 * la session en base et vérifient la propriété de chaque objet touché.
 */
export function middleware(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const url = new URL("/connexion", request.url);
  // Mémorise la destination pour y revenir après connexion.
  const target = request.nextUrl.pathname + request.nextUrl.search;
  if (target && target !== "/") url.searchParams.set("suite", target);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    /**
     * Tout, sauf : les routes d'authentification, la sonde de santé, la page
     * de connexion elle-même, et les ressources statiques.
     */
    "/((?!api/auth|api/health|connexion|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
