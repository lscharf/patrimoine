import "server-only";
import { randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  authAccount,
  authSession,
  authUser,
  authVerification,
} from "@/db/schema";

/* ------------------------------------------------------------------ *
 * Configuration d'environnement
 * ------------------------------------------------------------------ */

const isProduction = process.env.NODE_ENV === "production";

/**
 * `next build` évalue les modules serveur pour collecter les métadonnées des
 * pages. L'image Docker est construite avec `NODE_ENV=production` et **sans**
 * fichier d'environnement — `.dockerignore` exclut `.env` à dessein, un secret
 * n'ayant rien à faire dans une image publiée.
 *
 * Exiger le secret à ce moment-là reviendrait à en faire une dépendance de
 * compilation, alors qu'il n'est nécessaire qu'à l'exécution. On distingue
 * donc les deux phases.
 */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

function requiredSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;

  // À l'exécution, l'absence de secret est fatale : mieux vaut un conteneur
  // qui refuse de démarrer qu'une application dont les sessions se signent
  // avec une clé devinable.
  if (isProduction && !isBuildPhase) {
    throw new Error(
      "BETTER_AUTH_SECRET est absent ou trop court (32 caractères minimum). " +
        "Générez-le avec : openssl rand -base64 32",
    );
  }

  if (isBuildPhase) {
    // Aucune requête n'est servie pendant la construction : cette valeur ne
    // signe jamais rien. Elle est tirée au hasard pour qu'un secret de
    // construction ne puisse pas se retrouver en production par inadvertance.
    return randomBytes(32).toString("base64");
  }

  // En développement, une clé fixe évite d'invalider la session à chaque
  // redémarrage. Elle n'a aucune valeur de sécurité et le garde ci-dessus
  // interdit qu'elle serve en production.
  return "dev-secret-non-securise-a-ne-jamais-utiliser-en-production";
}

export const baseURL =
  process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

/**
 * Liste blanche des adresses autorisées.
 *
 * Le comportement est volontairement **fermé par défaut** : si la variable est
 * absente, personne ne peut créer de compte. Authelia authentifie l'ensemble
 * de votre annuaire ; sans ce second filtre, tout utilisateur de cet annuaire
 * accéderait à l'application.
 */
const allowedEmails = (process.env.AUTH_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowedEmails.includes(email.trim().toLowerCase());
}

export const allowlistConfigured = allowedEmails.length > 0;

/* ------------------------------------------------------------------ *
 * Fournisseur OIDC (Authelia)
 * ------------------------------------------------------------------ */

const autheliaIssuer = process.env.AUTHELIA_ISSUER?.replace(/\/$/, "");
const autheliaClientId = process.env.AUTHELIA_CLIENT_ID;
const autheliaClientSecret = process.env.AUTHELIA_CLIENT_SECRET;

/** L'OIDC ne s'active que si les trois paramètres sont fournis. */
export const oidcEnabled = Boolean(
  autheliaIssuer && autheliaClientId && autheliaClientSecret,
);

export const OIDC_PROVIDER_ID = "authelia";

const oidcPlugins = oidcEnabled
  ? [
      genericOAuth({
        config: [
          {
            providerId: OIDC_PROVIDER_ID,
            discoveryUrl: `${autheliaIssuer}/.well-known/openid-configuration`,
            clientId: autheliaClientId!,
            clientSecret: autheliaClientSecret!,
            scopes: ["openid", "profile", "email"],
            pkce: true,
          },
        ],
      }),
    ]
  : [];

/* ------------------------------------------------------------------ *
 * Instance
 * ------------------------------------------------------------------ */

export const auth = betterAuth({
  appName: "Patrimoine",
  secret: requiredSecret(),
  baseURL,
  trustedOrigins: [baseURL],

  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: authUser,
      session: authSession,
      account: authAccount,
      verification: authVerification,
    },
  }),

  emailAndPassword: {
    enabled: true,
    // Accès de secours : le durcissement (2FA, limitation de débit,
    // bannissement) est délégué à Authelia, dont c'est le métier.
    minPasswordLength: 12,
    autoSignIn: true,
    requireEmailVerification: false,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },

  advanced: {
    // Les cookies `__Secure-` exigent HTTPS. En développement sur
    // http://localhost, il faut donc les désactiver.
    useSecureCookies: baseURL.startsWith("https://"),
    defaultCookieAttributes: { sameSite: "lax" },
  },

  databaseHooks: {
    user: {
      create: {
        /** Aucun compte ne peut naître hors de la liste blanche. */
        before: async (user) => {
          if (!allowlistConfigured) {
            throw new APIError("FORBIDDEN", {
              message:
                "Aucune adresse autorisée n'est configurée. Renseignez AUTH_ALLOWED_EMAILS.",
            });
          }
          if (!isEmailAllowed(user.email)) {
            throw new APIError("FORBIDDEN", {
              message: "Cette adresse n'est pas autorisée à accéder à l'application.",
            });
          }
        },
        /**
         * Rattache au premier utilisateur les comptes créés avant la mise en
         * place de l'authentification. Sans cela, un portefeuille existant
         * deviendrait invisible après la bascule.
         */
        after: async (user) => {
          const orphans = db
            .select({ id: accounts.id })
            .from(accounts)
            .where(isNull(accounts.userId))
            .all();
          if (orphans.length === 0) return;
          db.update(accounts)
            .set({ userId: user.id })
            .where(isNull(accounts.userId))
            .run();
          console.info(
            `[auth] ${orphans.length} compte(s) existant(s) rattaché(s) à ${user.email}`,
          );
        },
      },
    },
    session: {
      create: {
        /**
         * Second contrôle, à chaque ouverture de session : retirer une adresse
         * de la liste blanche doit suffire à couper l'accès, sans avoir à
         * supprimer l'utilisateur en base.
         */
        before: async (session) => {
          const owner = db
            .select({ email: authUser.email })
            .from(authUser)
            .where(eq(authUser.id, session.userId))
            .get();
          if (!isEmailAllowed(owner?.email)) {
            throw new APIError("FORBIDDEN", {
              message: "Cette adresse n'est plus autorisée à accéder à l'application.",
            });
          }
        },
      },
    },
  },

  // `nextCookies` doit rester en dernier : il intercepte les en-têtes
  // `Set-Cookie` produits par les autres greffons.
  plugins: [...oidcPlugins, nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
