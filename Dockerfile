# syntax=docker/dockerfile:1.7

# ===========================================================================
# Image de production — application patrimoniale Next.js + SQLite.
#
# Base Debian (bookworm-slim) et NON Alpine : c'est un choix délibéré.
# `better-sqlite3` est un module natif compilé contre la glibc. Sur Alpine
# (musl), soit aucun binaire précompilé ne correspond, soit il faut traîner
# toute la chaîne de compilation dans l'image finale. Debian évite les deux.
# ===========================================================================


# ---------------------------------------------------------------------------
# Étape 1 — deps : installation des dépendances
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app

# Chaîne node-gyp (python3 / make / g++) pour `better-sqlite3`.
# En pratique le paquet embarque des binaires précompilés glibc et n'a pas
# besoin de compiler ; ces outils sont le filet de sécurité si l'architecture
# hôte n'est pas couverte. Ils restent confinés à cette étape et
# n'apparaissent JAMAIS dans l'image finale.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Copier d'abord les seuls manifestes : la couche `npm ci` reste en cache tant
# que les dépendances ne changent pas, même si le code source change.
COPY package.json package-lock.json ./

# `npm ci` (et non `npm install`) : installation reproductible depuis le
# lockfile. Il applique aussi le bloc `overrides` de package.json, qui force
# `better-auth` à réutiliser la même version de `better-sqlite3` que
# l'application — sinon deux copies du module natif cohabiteraient.
RUN npm ci


# ---------------------------------------------------------------------------
# Étape 2 — builder : compilation Next.js
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
# NODE_ENV=production dès la construction : Next élimine le code de dev.
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `output: "standalone"` (déjà dans next.config.ts) produit .next/standalone,
# qui contient server.js et un node_modules élagué aux modules réellement
# atteignables.
RUN npm run build

# Préparation du module natif `better-sqlite3`.
#
# Pourquoi cette étape existe : `better-sqlite3` v13 ne résout pas son binaire
# statiquement. lib/binding.js calcule le chemin à l'exécution :
#     path.join(__dirname, '..', 'prebuilds', `${platform}-${arch}.node`)
# Le traceur de fichiers de Next ne voit donc qu'un seul `.node`, celui de la
# plateforme qui a lancé la compilation. Vérifié sur ce projet : une
# construction sur macOS ne trace que `prebuilds/darwin-arm64.node`.
# On reconstitue donc explicitement le paquet avec les binaires Linux, au lieu
# de dépendre de ce que le traçage a bien voulu retenir.
# Le `test -f` final fait échouer la construction tout de suite si le binaire de
# l'architecture cible manque, au lieu de livrer un conteneur qui plante au
# premier accès à la base.
RUN set -eux; \
    mkdir -p /opt/better-sqlite3/prebuilds; \
    cp -R node_modules/better-sqlite3/lib /opt/better-sqlite3/lib; \
    cp node_modules/better-sqlite3/package.json /opt/better-sqlite3/package.json; \
    cp node_modules/better-sqlite3/prebuilds/linux-x64.node   /opt/better-sqlite3/prebuilds/; \
    cp node_modules/better-sqlite3/prebuilds/linux-arm64.node /opt/better-sqlite3/prebuilds/; \
    test -f "/opt/better-sqlite3/prebuilds/linux-$(node -p 'process.arch').node"


# ---------------------------------------------------------------------------
# Étape 3 — runner : image finale d'exécution
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app

# Version exposée par /api/health. Seule donnée injectée à la construction —
# aucun secret n'est inscrit dans une couche d'image.
ARG APP_VERSION=0.1.0
ENV APP_VERSION=${APP_VERSION}

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    PORTFOLIO_DB_PATH=/app/data/portfolio.db

# --- Copie de la sortie standalone ---
# Chemins vérifiés sur l'arborescence réelle produite par `npm run build`.

# Racine standalone : server.js, package.json et le node_modules élagué.
COPY --from=builder --chown=node:node /app/.next/standalone ./

# Les actifs statiques ne sont volontairement PAS inclus dans standalone par
# Next (il les suppose servis par un CDN). Il faut les replacer à la main sous
# la racine standalone, sinon l'application se charge sans CSS ni JS.
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Actifs publics (icônes SVG).
COPY --from=builder --chown=node:node /app/public ./public

# Migrations SQL — indispensable et facile à oublier.
# Les migrations s'exécutent au démarrage du serveur et lisent les .sql depuis
# `path.join(process.cwd(), "drizzle")`. Or server.js fait `process.chdir(__dirname)`,
# donc le cwd vaut /app : les fichiers doivent être exactement ici. Sans eux,
# le conteneur démarre sur une base vide et sans aucun schéma.
COPY --from=builder --chown=node:node /app/drizzle ./drizzle

# Module natif reconstitué, écrasant la version partiellement tracée.
COPY --from=builder --chown=node:node /opt/better-sqlite3 ./node_modules/better-sqlite3

# Répertoire de données, créé et attribué à `node` APRÈS toutes les COPY : un
# point de montage déclaré trop tôt avalerait silencieusement ce qu'une COPY
# ultérieure y écrirait.
# Docker initialise un volume nommé vide à partir du contenu de ce chemin dans
# l'image, propriétaire compris. Sans ce chown, le volume naîtrait root et
# SQLite échouerait en écriture au tout premier démarrage.
RUN mkdir -p /app/data && chown -R node:node /app/data
VOLUME ["/app/data"]

# Exécution sans privilèges : l'utilisateur `node` (uid 1000) existe déjà dans
# l'image officielle.
USER node

EXPOSE 3000

# Sonde de santé via le binaire node déjà présent : ni curl ni wget à
# installer, donc aucune surface supplémentaire dans l'image finale.
# `start-period` laisse le temps aux migrations de s'appliquer au démarrage.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Démarrage direct du serveur standalone : pas de script d'entrée.
# Les migrations sont jouées par l'application elle-même au boot, et
# `drizzle-kit` comme `tsx` sont des dépendances de développement absentes de
# cette image.
CMD ["node", "server.js"]
