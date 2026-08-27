import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

const DB_PATH =
  process.env.PORTFOLIO_DB_PATH ??
  path.join(process.cwd(), "data", "portfolio.db");

/**
 * Next recharge les modules à chaque requête en dev : on garde une seule
 * connexion SQLite sur le global pour ne pas ouvrir des centaines de handles.
 */
const globalForDb = globalThis as unknown as {
  __sqlite?: Database.Database;
};
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

/**
 * Applique les migrations en attente au démarrage du serveur.
 *
 * C'est le seul moment où elles peuvent l'être en conteneur : l'image
 * d'exécution ne contient ni `tsx` ni `drizzle-kit`, et la commande de
 * démarrage est un simple `node server.js`. Sans cela, un volume neuf
 * donnerait une base vide et la première requête échouerait.
 *
 * L'opération est ignorée pendant la phase de compilation `next build`
 * pour éviter les conflits d'accès concurrents entre les workers de build.
 * L'opération est idempotente — Drizzle tient un journal des migrations
 * appliquées — et coûte quelques millisecondes lorsqu'il n'y a rien à faire.
 */
function runMigrations(connection: Database.Database) {
  if (isBuildPhase) return;
  const folder = path.join(process.cwd(), "drizzle");
  if (!fs.existsSync(folder)) {
    console.warn(
      `[db] dossier de migrations introuvable (${folder}) — schéma non vérifié.`,
    );
    return;
  }
  try {
    migrate(drizzle(connection), { migrationsFolder: folder });
  } catch (err) {
    console.error("[db] échec des migrations :", err);
    throw err;
  }
}

function createConnection() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  runMigrations(sqlite);
  return sqlite;
}

export const sqlite = globalForDb.__sqlite ?? createConnection();
if (process.env.NODE_ENV !== "production") globalForDb.__sqlite = sqlite;

export const db = drizzle(sqlite, { schema });
export { schema };
