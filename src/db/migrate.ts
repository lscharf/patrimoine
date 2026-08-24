import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import fs from "node:fs";

const DB_PATH =
  process.env.PORTFOLIO_DB_PATH ??
  path.join(process.cwd(), "data", "portfolio.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
migrate(drizzle(sqlite), { migrationsFolder: path.join(process.cwd(), "drizzle") });
sqlite.close();
console.log(`✓ Base à jour → ${DB_PATH}`);
