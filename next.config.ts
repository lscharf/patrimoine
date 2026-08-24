import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Sortie autonome : l'image Docker n'embarque que le serveur et les modules
   * réellement utilisés, au lieu de tout `node_modules`.
   */
  output: "standalone",

  /**
   * better-sqlite3 est un module natif : il doit rester en `require` côté
   * serveur au lieu d'être empaqueté par le bundler.
   */
  serverExternalPackages: ["better-sqlite3"],

  /**
   * `src/db/index.ts` calcule le chemin de la base avec `process.cwd()`. Le
   * traceur de Next résout cette expression sur le disque au moment du build
   * et embarque donc `data/portfolio.db` — le portefeuille réel — dans
   * `.next/standalone`. On l'exclut pour toutes les routes : la base est
   * montée en volume à l'exécution, jamais copiée dans le build.
   */
  outputFileTracingExcludes: {
    "*": ["./data/**"],
  },
};

export default nextConfig;
