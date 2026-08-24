import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./config";

/**
 * `cache()` déduplique la lecture de session sur toute la durée d'un rendu :
 * la page, l'entête et chaque requête de données partagent le même appel.
 */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

/**
 * Pour les composants serveur : redirige vers la page de connexion si aucune
 * session valide n'est présente.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session?.user) redirect("/connexion");
  return session;
}

/** Identifiant de l'utilisateur courant, ou null. */
export async function currentUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id ?? null;
}

/**
 * Pour les composants serveur : identifiant de l'utilisateur, en redirigeant
 * si la session manque.
 */
export async function requireUserId(): Promise<string> {
  const session = await requireSession();
  return session.user.id;
}
