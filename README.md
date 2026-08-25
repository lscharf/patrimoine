# Patrimoine

Suivi de patrimoine personnel, auto-hébergé. Une alternative locale à Finary :
comptes, lignes, transactions, cours en temps réel et courbe de performance —
sans envoyer vos données financières à un tiers.

## Démarrer

```bash
npm install
npm run dev
```

L'application est disponible sur http://localhost:3000. La base est créée et
migrée automatiquement au premier lancement.

Pour explorer l'interface avec un portefeuille fictif :

```bash
npm run seed -- --reset
```

## Ce que fait l'application

- **Comptes → lignes → transactions.** Une ligne accepte plusieurs achats et
  ventes : le prix de revient unitaire (PRU) est recalculé en moyenne pondérée
  à chaque opération, comme le veut la règle fiscale française.
- **Cours automatiques.** ETF Euronext, actions, cryptomonnaies et devises sont
  récupérés sans clé d'API. Un cache local évite de solliciter le fournisseur à
  chaque affichage.
- **Multi-devises.** Une ligne cotée en dollars est convertie en euros au taux
  du jour, et son prix de revient au taux qui avait cours le jour de chaque
  achat — l'effet de change apparaît donc comme une composante réelle de la
  performance.
- **Lignes non cotées.** PEE, livrets, parts sociales : versements et
  valorisations saisis à la main, intégrés à la courbe comme les autres.
- **Performance nette des apports.** Un versement de 500 € n'est pas compté
  comme un gain de 500 €. C'est l'erreur la plus courante des suivis maison.

## Authentification

L'application est protégée dès le premier démarrage. Deux moyens de connexion
cohabitent :

- **Mot de passe local**, créé en ligne de commande — accès de secours.
- **OIDC**, testé avec Authelia — le moyen normal une fois l'application exposée.

### Mise en route

```bash
cp .env.example .env
openssl rand -base64 32   # à coller dans BETTER_AUTH_SECRET
```

Renseignez au minimum `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` et
`AUTH_ALLOWED_EMAILS`, puis créez votre compte :

```bash
npm run auth:user
```

Les comptes du portefeuille créés avant l'authentification sont
automatiquement rattachés à ce premier utilisateur.

### La liste blanche n'est pas optionnelle

`AUTH_ALLOWED_EMAILS` énumère les adresses autorisées. Le comportement est
**fermé par défaut** : sans cette variable, aucun compte ne peut être créé et
aucune connexion n'aboutit.

C'est le point à ne pas négliger avec l'OIDC. Authelia authentifie l'ensemble
de votre annuaire ; si l'application se contentait de vérifier « cet
utilisateur est authentifié », **tout compte Authelia accéderait à votre
portefeuille**. La liste blanche est ce second filtre. Elle est vérifiée à la
création du compte *et* à chaque ouverture de session : retirer une adresse
suffit à couper l'accès, sans toucher à la base.

### Configurer Authelia

Déclarez un client dans `identity_providers.oidc.clients` :

```yaml
- client_id: patrimoine
  client_name: Patrimoine
  client_secret: '$pbkdf2-sha512$310000$...'   # le hash, pas le secret
  public: false
  authorization_policy: two_factor
  require_pkce: true
  pkce_challenge_method: S256
  redirect_uris:
    - https://votre-domaine/api/auth/callback/authelia
  scopes: [openid, profile, email]
  token_endpoint_auth_method: client_secret_basic
```

L'URI de redirection est `/api/auth/callback/<providerId>`. Beaucoup
d'exemples en circulation indiquent `/api/auth/oauth2/callback/...`, chemin des
versions antérieures de Better Auth : il produit une erreur
`redirect_uri mismatch` peu explicite.

L'adresse comparée à la liste blanche est celle transmise par Authelia dans le
jeton d'identité, qui n'est pas toujours celle attendue.

### Comment la protection est construite

Trois couches, volontairement redondantes :

1. **Middleware** — vérifie la présence du cookie de session. Il tourne sur le
   runtime Edge, ne peut pas interroger SQLite, et ne constitue donc qu'un
   raccourci d'ergonomie, jamais une barrière.
2. **Lectures** — `requireUserId()` valide la session en base ; toutes les
   requêtes filtrent sur le propriétaire.
3. **Écritures** — chaque server action vérifie la session puis la propriété de
   l'objet touché, en remontant la chaîne ligne → compte → utilisateur. Sans ce
   contrôle, un identifiant numérique deviné suffirait à supprimer les données
   d'autrui.

Les messages d'erreur ne distinguent pas « n'existe pas » de « ne vous
appartient pas », et « adresse inconnue » de « mot de passe incorrect » : cette
distinction permettrait d'énumérer comptes et identifiants.

## Déploiement Docker

L'image est publiée sur le registre GitHub à chaque fusion sur `main` :
`ghcr.io/lscharf/patrimoine`. Sur le serveur, il n'y a donc rien à construire.

```bash
curl -O https://raw.githubusercontent.com/lscharf/patrimoine/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/lscharf/patrimoine/main/.env.example
# renseigner .env, puis :
docker compose up -d
```

Voir [docs/docker.md](docs/docker.md) pour le détail — étiquettes disponibles,
visibilité du paquet, mise à jour et retour arrière.

Les migrations s'appliquent à l'ouverture de la connexion, donc à chaque
démarrage du conteneur : un volume neuf produit une base complète sans
intervention.

Le port n'est délibérément publié que sur `127.0.0.1`. Les cookies sécurisés et
les redirections OIDC exigent HTTPS : l'application doit être placée derrière
un proxy inverse assurant la terminaison TLS.

## Architecture

```
src/db/            Schéma Drizzle et connexion SQLite
src/server/
  prices/          Fournisseur de cours (interface + implémentation Yahoo) et cache
  portfolio/       Prix de revient, valorisation, reconstruction de l'historique
  actions/         Mutations (server actions) et validation Zod
  queries.ts       Lectures pour les composants serveur
src/components/    Design system, graphiques, tableaux, formulaires
src/app/           Pages
```

### Le point délicat : la courbe historique

Afficher « 3 mois » ne consiste pas à relire une valeur stockée chaque jour :
le portefeuille est **reconstruit** date par date. Pour chaque jour de la
fenêtre, le moteur calcule la quantité détenue à cette date, la multiplie par
le cours de clôture du jour et par le taux de change du jour, puis additionne
toutes les lignes.

Conséquence utile : ajouter aujourd'hui un achat daté de l'an dernier corrige
rétroactivement toute la courbe. Un système à instantanés quotidiens en serait
incapable.

Les fenêtres `1J` et `7J` passent par des données infra-journalières (pas de
5 minutes et 1 heure) ; au-delà, la clôture quotidienne suffit. Les courbes
longues sont rééchantillonnées par l'algorithme *Largest Triangle Three
Buckets*, qui préserve pics et creux là où un échantillonnage régulier les
gommerait.

## Changer de fournisseur de cours

Tout passe par l'interface `PriceProvider` (`src/server/prices/provider.ts`).
Brancher Twelve Data, CoinGecko ou une autre source revient à écrire une
seconde implémentation et à modifier la ligne d'import dans
`src/server/prices/cache.ts`.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement (migre la base au passage) |
| `npm run build` | Build de production |
| `npm run seed -- --reset` | Jeu de démonstration |
| `npm run import` | Import du portefeuille réel (script local, hors dépôt) |
| `npm run db:reset` | Vide le portefeuille en conservant le cache de cours |
| `npm run db:studio` | Explorateur de base Drizzle |
| `npm run check:engine` | Vérifie valorisation et historique en console |
| `npm run auth:user` | Crée le compte d'accès (mot de passe saisi masqué) |

## Données

Tout est stocké dans `data/portfolio.db` (SQLite). Sauvegarder revient à copier
ce fichier. Il est exclu du dépôt par `.gitignore`.
