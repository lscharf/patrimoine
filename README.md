# Patrimoine 💼

> **Suivi de patrimoine financier personnel, auto-hébergé, souverain et sans télémétrie.**
> Centralisez vos comptes (PEA, compte-titres, crypto, épargne salariale, livrets), suivez vos crédits et emprunts (Passif), visualisez vos cours en temps réel et pilotez votre patrimoine net réel.
[![Docker Image](https://img.shields.io/badge/Docker-ghcr.io%2Flscharf%2Fpatrimoine-blue?logo=docker&logoColor=white)](https://github.com/lscharf/patrimoine/pkgs/container/patrimoine)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black)](https://react.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Ce que fait l'application

- **Arborescence Comptes → Lignes → Transactions** :
  - Comptes d'investissement et d'épargne (`PEA`, `CTO`, `CRYPTO`, `PEE`, `AV`, `LIVRET`, `Autre`).
  - Lignes cotées (actions, ETF, crypto) ou non cotées (PEE, livrets, parts sociales).
  - Gestion unitaire des opérations : achats, ventes partielles, versements, retraits, dividendes et frais.
- **Cotations automatiques** :
  - Recherche et synchronisation des cours en direct pour actions, ETF et crypto via Yahoo Finance.
- **Calcul rigoureux du PRU (Prix de Revient Unitaire)** :
  - Méthode du prix moyen pondéré (standard fiscal français).
  - Gestion multi-devises avec conversion au taux de change historique du jour de chaque transaction pour isoler fidèlement l'effet de change.
- **Courbe de performance réelle (1J à TOUT)** :
  - Performance calculée **nette des apports et retraits** : un versement de 500 € n'apparaît pas artificiellement comme un gain.
- **Passif & Gestion des Emprunts (expérience complète type Finary)** :
  - Prise en charge des crédits immobiliers, prêts à la consommation, PTZ (Prêt à Taux Zéro) et prêts in fine.
  - **Regroupement par projet** : regroupez par exemple le prêt principal et le PTZ sous un même projet (*Résidence Principale*) avec totaux de capital restant dû et mensualités consolidés.
  - **Moteur d'amortissement précis** : calcul automatique de l'échéancier mois par mois, part capital / intérêts / assurance, et courbe d'extinction de la dette.
  - **Vue détaillée à 3 onglets** :
    - *Aperçu* : grand montant du capital restant dû, phrase d'état, courbe interactive d'amortissement et indicateurs clés.
    - *Analyse* : donut de répartition de la mensualité, décomposition du coût total, total remboursé et échéancier complet.
    - *Paramètres* : modification des caractéristiques et possibilité de calibrer le solde au centime près sur vos relevés bancaires.
  - **Calcul du Patrimoine Net** : $\text{Patrimoine Net} = \text{Actifs Bruts} - \text{Passif / Dettes}$ affiché en temps réel sur le tableau de bord.
- **Mode discrétion (Privacy)** :
  - Masquage des montants d'un clic pour partager ou montrer son écran en public sans dévoiler ses chiffres (injecté dès le rendu serveur sans flash visuel).
- **Intégrations & API** :
  - Endpoint REST `/api/summary` pour connecter des widgets de bureau ou scripts personnels.
  - Widget natif pour la barre d'état Linux : [**Plugin Omarchy Bar**](https://github.com/lscharf/patrimoine.plugin).

## Principes d'architecture

Le moteur financier s'appuie sur trois choix fondamentaux :

### 1. L'historique est reconstruit, pas enregistré
La courbe de patrimoine n'est pas une suite d'instantanés journaliers figés en base. Elle est **recalculée date par date** : $\text{Quantité détenue} \times \text{Cours de clôture} \times \text{Taux de change du jour}$.

Saisir aujourd'hui une opération passée d'il y a six mois recalcule automatiquement et fidèlement toute la trajectoire historique.

### 2. Stratégie de cache anti-rafale
Pour éviter de saturer les fournisseurs de cours et préserver la réactivité :
- **Cours du jour (Live)** : 1 requête groupée par minute maximum.
- **Clôtures quotidiennes** : 1 interrogation par instrument et par heure.
- **Intraday (1J, 7J)** : Cache en mémoire vive (processus) toutes les 5 minutes.
- **Garde-fous de marché** : Mémorisation de la dernière tentative (`history_checked_at`) pour ne pas relancer indéfiniment les places fermées le week-end, et de la date la plus ancienne sollicitée (`history_from`).

### 3. SQLite en mode WAL
Toutes les données résident dans un unique fichier SQLite (`data/portfolio.db` / `/app/data/portfolio.db`). La base tourne en mode **WAL** (*Write-Ahead Logging*) pour des lectures/écritures hautement concurrentes et des transactions ACID instantanées.

---

## Déploiement avec Docker

L'application est disponible sous forme d'image prête à l'emploi : `ghcr.io/lscharf/patrimoine:latest`.

Elle nécessite d'être placée derrière un proxy inverse TLS (Traefik, Nginx, Caddy...) car les cookies de session sont marqués `Secure`.

### 1. Récupérer les fichiers de déploiement

```bash
mkdir -p ~/patrimoine && cd ~/patrimoine
curl -O https://raw.githubusercontent.com/lscharf/patrimoine/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/lscharf/patrimoine/main/.env.example
```

### 2. Renseigner `.env`

#### Option A : Mode autonome (Mot de passe local)

```bash
BETTER_AUTH_SECRET=      # Générer avec : openssl rand -base64 32
BETTER_AUTH_URL=         # URL publique HTTPS, ex : https://patrimoine.exemple.fr
AUTH_ALLOWED_EMAILS=     # Votre adresse e-mail autorisée
PATRIMOINE_API_TOKEN=    # Jeton secret pour l'API (ex: openssl rand -hex 24)
```

#### Option B : Mode avec SSO Authelia (OIDC)

Complétez les variables précédentes avec :

```bash
AUTHELIA_ISSUER=         # URL Authelia, ex : https://auth.exemple.fr
AUTHELIA_CLIENT_ID=patrimoine
AUTHELIA_CLIENT_SECRET=  # Secret en clair partagé avec Authelia
```

*(Guide de configuration Authelia complet disponible dans [docs/docker.md](docs/docker.md)).*

> 🔒 **Sécurité par défaut** : La variable `AUTH_ALLOWED_EMAILS` est une liste blanche fermée obligatoire. Aucune session ni compte ne peut être ouvert par une adresse absente de cette liste.

### 3. Démarrer

```bash
docker compose up -d
```

Les migrations SQL s'appliquent automatiquement au démarrage : un volume neuf produit une base prête sans intervention.

### 4. Premier accès
Ouvrez l'application dans votre navigateur : tant qu'aucun compte n'existe, l'écran d'accueil propose de créer votre compte administrateur. Le formulaire d'inscription disparaît définitivement une fois le premier compte créé.

---

## Intégrations & API

### API REST Synthétique
Un point d'accès rapide est disponible sur `GET /api/summary` :
- **Authentification** : Header `Authorization: Bearer <PATRIMOINE_API_TOKEN>` ou `X-API-Key: <PATRIMOINE_API_TOKEN>`.
- **Paramètre optionnel** : `?range=1M` (ou `1J`, `7J`, `3M`, `6M`, `YTD`, `1A`, `TOUT`).
- **Retour** : JSON compact avec valorisation globale, plus-value latente, variation de la période, liste des comptes et des lignes.

### Plugin pour barre d'état (Omarchy Linux)
Pour afficher votre patrimoine et sa variation en 1 clic dans votre barre supérieure sous Linux (Hyprland / Omarchy) :
👉 [**Dépôt du plugin Omarchy**](https://github.com/lscharf/patrimoine.plugin)

---

## Sauvegarde & Maintenance

### ⚠️ Le piège de la sauvegarde en mode WAL
La base tournant en mode WAL, copier le seul fichier `portfolio.db` pendant que le conteneur est actif produit une sauvegarde **incomplète** (les écritures récentes résident dans `portfolio.db-wal`).

Utilisez toujours l'API de sauvegarde SQLite à chaud :

```bash
docker exec patrimoine node -e "new (require('better-sqlite3'))('/app/data/portfolio.db').backup('/app/data/backup.db')"
docker cp patrimoine:/app/data/backup.db ./patrimoine-$(date +%F).db
```

Détails complets et procédures de restauration dans [**docs/docker.md**](docs/docker.md).

---

## Développement local

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer l'environnement local
cp .env.example .env
# Renseigner au moins AUTH_ALLOWED_EMAILS

# 3. Lancer le serveur de développement
npm run dev

# 4. Charger un jeu de données de test complet
npm run seed -- --reset
```

### Commandes utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | Lance le serveur de développement Next.js (Turbopack) |
| `npm run build` | Compile l'application en mode production autonome |
| `npm run seed -- --reset` | Réinitialise et remplit la base avec un jeu de démonstration complet |
| `npm run db:reset` | Vide le portefeuille en conservant le cache des cours |
| `npm run db:studio` | Ouvre l'interface Drizzle Studio pour inspecter la base SQLite |
| `npm run check:engine` | Exécute et vérifie les calculs de valorisation et d'historique en console |
| `npm run auth:user` | Crée un compte utilisateur local en CLI (mode dev) |

---

## Documentation complémentaire

- [**docs/docker.md**](docs/docker.md) : Guide détaillé d'exploitation, configuration Traefik/Reverse proxy, diagnostic et restauration.
- [**KNOWLEDGE.md**](KNOWLEDGE.md) : Documentation technique approfondie de l'architecture, du modèle relationnel et des formules mathématiques.
