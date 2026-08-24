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
};

export default nextConfig;
