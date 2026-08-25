/**
 * Sonde de santé du conteneur — utilisée par le `HEALTHCHECK` Docker.
 *
 * Contraintes volontaires :
 *  - aucune authentification : le démon Docker interroge cette route sans session ;
 *  - aucun import depuis `src/db/**` ni `src/server/**` : la sonde doit rester
 *    verte même si la base SQLite est verrouillée ou en cours de migration.
 *    Une sonde qui tombe en même temps que la base ferait redémarrer le
 *    conteneur en boucle au lieu de laisser la migration se terminer.
 */

// Rendu à chaque requête : jamais de mise en cache d'un « ok » périmé.
export const dynamic = "force-dynamic";

// Exécution Node (et non Edge) : `process.uptime()` n'existe pas côté Edge.
export const runtime = "nodejs";

export async function GET() {
  return Response.json(
    {
      status: "ok",
      // Secondes écoulées depuis le démarrage du processus serveur.
      uptime: Math.round(process.uptime()),
      // Injectée à la construction de l'image via l'ARG/ENV `APP_VERSION`.
      version: process.env.APP_VERSION ?? "inconnue",
    },
    { status: 200 },
  );
}
