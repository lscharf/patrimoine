import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
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

function createConnection() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return sqlite;
}

export const sqlite = globalForDb.__sqlite ?? createConnection();
if (process.env.NODE_ENV !== "production") globalForDb.__sqlite = sqlite;

export const db = drizzle(sqlite, { schema });
export { schema };
