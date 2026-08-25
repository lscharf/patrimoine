"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Client d'authentification.
 *
 * L'URL de base est déduite de l'origine courante : l'application est servie
 * depuis le même domaine que son API, y compris derrière un proxy inverse.
 */
export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
