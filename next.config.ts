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
   * Le chemin par défaut de la base (`process.cwd()/data/portfolio.db`) est
   * résolu par le traceur de Next sur le disque réel : sans cette exclusion,
   * `next build` recopie la base de production — positions comprises — dans
   * `.next/standalone/data/`. L'image Docker n'est pas concernée
   * (`.dockerignore` exclut `data`), mais tout déploiement par rsync ou tout
   * artefact de CI publierait le portefeuille.
   */
  outputFileTracingExcludes: {
    "*": ["./data/**"],
  },
};

export default nextConfig;
