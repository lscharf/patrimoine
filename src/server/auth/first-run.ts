import "server-only";
import { db } from "@/db";
import { authUser } from "@/db/schema";

/**
 * Vrai tant qu'aucun compte n'existe.
 *
 * Sert à proposer la création du premier accès directement dans l'interface.
 * En conteneur, c'est le seul moyen praticable : l'image d'exécution ne
 * contient ni `tsx` ni les sources, donc `npm run auth:user` n'y est pas
 * disponible. Sans cet écran, une installation Docker sans OIDC serait
 * inaccessible à son propre propriétaire.
 *
 * L'ouverture n'est pas un risque : la création reste soumise à la liste
 * blanche, fermée par défaut. Une adresse absente de `AUTH_ALLOWED_EMAILS`
 * est refusée, qu'il existe déjà un compte ou non.
 */
export function aucunCompteExistant(): boolean {
  return db.select({ id: authUser.id }).from(authUser).limit(1).get() == null;
}
