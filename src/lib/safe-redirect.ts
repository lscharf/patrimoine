/**
 * Valide une destination de redirection issue de l'URL.
 *
 * Sans ce filtre, `?suite=https://site-malveillant.example` transformerait la
 * page de connexion en tremplin de redirection ouverte : un lien portant votre
 * domaine renverrait l'utilisateur ailleurs après authentification.
 *
 * Seuls les chemins internes sont acceptés. `//evil.com` est rejeté : le
 * navigateur l'interpréterait comme une URL absolue à schéma implicite.
 */
export function safeRedirect(
  target: string | string[] | undefined,
  fallback = "/",
): string {
  const value = Array.isArray(target) ? target[0] : target;
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
