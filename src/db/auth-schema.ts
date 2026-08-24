import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Tables de Better Auth.
 *
 * Elles sont préfixées `auth_` pour éviter toute confusion avec la table
 * `accounts` du portefeuille : Better Auth nomme « account » le lien entre un
 * utilisateur et un fournisseur d'identité, ce qui n'a rien à voir avec un
 * compte-titres.
 *
 * Les noms de propriétés JavaScript sont imposés par l'adaptateur Drizzle de
 * Better Auth (il résout les champs par ces clés) ; les noms de colonnes SQL
 * restent en snake_case pour rester cohérents avec le reste du schéma.
 */

export const authUser = sqliteTable(
  "auth_user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "boolean" })
      .notNull()
      .default(false),
    image: text("image"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("auth_user_email_unique").on(t.email)],
);

export const authSession = sqliteTable(
  "auth_session",
  {
    id: text("id").primaryKey(),
    /** Jeton de session porté par le cookie */
    token: text("token").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("auth_session_token_unique").on(t.token)],
);

/**
 * Rattachement à un fournisseur d'identité. `providerId` vaut `credential`
 * pour le mot de passe local, ou `authelia` pour l'OIDC.
 */
export const authAccount = sqliteTable("auth_account", {
  id: text("id").primaryKey(),
  /**
   * Émetteur de l'identité. Introduit par Better Auth 1.7 : deux fournisseurs
   * peuvent attribuer le même identifiant de sujet, l'unicité se juge donc sur
   * le couple (émetteur, identifiant).
   */
  issuer: text("issuer").notNull(),
  /** Identifiant de l'utilisateur chez le fournisseur (`sub` en OIDC) */
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => authUser.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp_ms",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp_ms",
  }),
  scope: text("scope"),
  /** Empreinte scrypt du mot de passe — uniquement pour `credential` */
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const authVerification = sqliteTable("auth_verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export type AuthUser = typeof authUser.$inferSelect;
