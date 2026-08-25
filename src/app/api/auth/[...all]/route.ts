import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth/config";

/** Expose les routes de Better Auth sous /api/auth/*. */
export const { GET, POST } = toNextJsHandler(auth.handler);
