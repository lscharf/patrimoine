# Patrimoine

Suivi de patrimoine personnel, auto-hébergé. Comptes, lignes, transactions,
cours de marché automatiques et courbe de performance — sans confier ses
données financières à un tiers.

Image publiée à chaque fusion sur `main` : `ghcr.io/lscharf/patrimoine:latest`.

---

## Déployer avec Docker

Deux modes, au choix. Le premier suffit à faire tourner l'application ; le
second n'a d'intérêt que si vous centralisez déjà vos accès.

| | **Autonome** | **Avec Authelia** |
|---|---|---|
| Connexion | mot de passe local | Authelia, plus le mot de passe local en secours |
| Variables à renseigner | 3 | 6 |
| À prévoir | un proxy inverse TLS | un proxy inverse TLS et une instance Authelia |

Les étapes 1, 3 et 4 sont communes ; seule l'étape 2 diffère.

### 1. Récupérer les fichiers

```bash
mkdir -p ~/patrimoine && cd ~/patrimoine
curl -O https://raw.githubusercontent.com/lscharf/patrimoine/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/lscharf/patrimoine/main/.env.example
```

### 2. Renseigner `.env`

#### Mode autonome

Trois variables, et c'est tout :

```bash
BETTER_AUTH_SECRET=      # openssl rand -base64 32
BETTER_AUTH_URL=         # URL publique, ex. https://patrimoine.exemple.fr
AUTH_ALLOWED_EMAILS=     # votre adresse
```

Laissez les trois `AUTHELIA_*` vides ou commentées : l'OIDC ne s'active que si
elles sont **toutes les trois** renseignées, et le bouton correspondant
n'apparaît pas.

#### Mode Authelia

Les trois mêmes, plus :

```bash
AUTHELIA_ISSUER=         # ex. https://auth.exemple.fr
AUTHELIA_CLIENT_ID=patrimoine
AUTHELIA_CLIENT_SECRET=  # le secret en clair (l'empreinte va chez Authelia)
```

Il faut aussi déclarer le client côté Authelia — voir plus bas.

> Dans les deux cas, `AUTH_ALLOWED_EMAILS` n'est pas optionnel : sans lui
> **aucun compte ne peut être créé ni aucune session ouverte**. Le comportement
> est fermé par défaut, volontairement.

### 3. Démarrer

```bash
docker compose up -d
```

Les migrations s'appliquent au démarrage : un volume neuf produit une base
complète sans intervention.

### 4. Créer son accès

Ouvrez l'application : tant qu'aucun compte n'existe, elle propose de créer le
vôtre. Le formulaire disparaît définitivement une fois le compte créé, et
n'accepte qu'une adresse figurant dans `AUTH_ALLOWED_EMAILS`.

En mode Authelia, vous pouvez aussi bien vous connecter directement par
« Se connecter avec Authelia » : la première connexion d'une adresse autorisée
crée le compte.

### Le port n'est pas publié sur toutes les interfaces

Par défaut le compose écoute sur `127.0.0.1:3000`. L'application parle du HTTP
en clair et n'a aucune notion de TLS : elle doit se trouver derrière un proxy
inverse qui termine le chiffrement.

**Si votre proxy tourne sur une autre machine**, cette liaison à la boucle
locale le rendra injoignable. Remplacez-la par l'adresse LAN de l'hôte :

```yaml
ports:
  - "192.168.1.99:3000:3000"
```

---

## Déclarer le client Authelia

*Mode Authelia uniquement — sautez cette section en mode autonome.*

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
    - https://VOTRE-DOMAINE/api/auth/callback/authelia
  scopes: [openid, profile, email]
  token_endpoint_auth_method: client_secret_post
```

Générer le secret et son empreinte :

```bash
docker run --rm authelia/authelia:latest authelia crypto hash generate pbkdf2 \
  --variant sha512 --random --random.length 72 --random.charset rfc3986
```

Puis compléter `.env` avec `AUTHELIA_ISSUER`, `AUTHELIA_CLIENT_ID` et
`AUTHELIA_CLIENT_SECRET`.

### Trois pièges

**L'URI de redirection est `/api/auth/callback/authelia`**, pas
`/api/auth/oauth2/callback/...`. Ce dernier était le chemin des versions
antérieures de Better Auth et traîne encore dans beaucoup d'exemples ; il
produit un `redirect_uri mismatch` peu bavard.

**`token_endpoint_auth_method` doit valoir `client_secret_post`.** Avec
`client_secret_basic`, l'échange échoue en `invalid_client`.

**La liste blanche compare l'adresse transmise par Authelia**, qui n'est pas
forcément celle attendue. Authelia authentifie *tout* votre annuaire : sans ce
second filtre, chacun de ses utilisateurs accéderait au portefeuille.

---

## Exploiter

```bash
docker compose pull && docker compose up -d   # mettre à jour
docker compose logs -f patrimoine             # journaux
```

Pour revenir en arrière, remplacer l'étiquette par un `:main-<sha>` précis.

### Sauvegarder

Les données vivent dans le volume `patrimoine-data`. Copier le seul fichier
`.db` pendant que le serveur tourne manque les transactions encore dans le
journal WAL. L'écart n'est pas théorique : sur cette instance, le `.db` vivant
pèse 4 Ko quand la sauvegarde cohérente en fait 1 044 Ko. Passez donc par
l'API de sauvegarde de SQLite :

```bash
docker exec patrimoine node -e "new (require('better-sqlite3'))('/app/data/portfolio.db').backup('/app/data/backup.db')"
docker cp patrimoine:/app/data/backup.db ./patrimoine-$(date +%F).db
```

Détails complets dans [docs/docker.md](docs/docker.md).

---

## Ce que fait l'application

- **Comptes → lignes → transactions.** Une ligne accepte plusieurs achats,
  ventes, dividendes et frais ; le prix de revient unitaire est une moyenne
  pondérée.
- **Cours automatiques** pour actions, ETF et crypto, via Yahoo Finance.
- **Lignes non cotées** (PEE, livrets) valorisées à la main.
- **Multi-devises** : le prix de revient est converti au taux du jour de chaque
  opération, ce qui isole l'effet de change.
- **Courbe de performance** de 1 jour à l'origine, avec la variation de chaque
  ligne sur la période choisie.
- **Masquage des montants** d'un clic, pour montrer son écran sans dévoiler les
  sommes.

---

## Développer en local

```bash
npm install
npm run dev
```

La base est créée et migrée au premier lancement. Pour un portefeuille fictif :

```bash
npm run seed -- --reset
```

L'authentification s'applique aussi en local : renseignez au moins
`AUTH_ALLOWED_EMAILS` dans un fichier `.env`. Le compte se crée depuis
l'interface, ou en ligne de commande avec `npm run auth:user` — cette seconde
voie n'existe qu'en développement, l'image d'exécution ne contenant ni `tsx`
ni les sources.

---

## Deux choix d'architecture

Le reste du code est ordinaire ; ces deux points ne le sont pas.

### L'historique est reconstruit, pas enregistré

La courbe n'est pas une suite d'instantanés quotidiens. Elle est recalculée
date par date : quantité détenue ce jour-là × cours de clôture × taux de change
du jour. Saisir aujourd'hui une transaction d'il y a six mois corrige donc
rétroactivement toute la courbe — ce qu'un historique de soldes stockés ne
permettrait pas.

La performance est toujours **nette des apports** : un versement de 500 € ne
doit pas apparaître comme un gain.

### Le cache des cours

| Donnée | Fréquence maximale |
|---|---|
| Cours du jour | 1 requête **groupée** par minute |
| Clôtures quotidiennes | 1 par instrument et par heure |
| Intraday (1J, 7J) | 1 par instrument toutes les 5 minutes |

En régime établi, naviguer entre les périodes ne déclenche aucune requête.

Deux garde-fous méritent d'être connus, car leur absence a été mesurée à six
requêtes superflues par affichage, indéfiniment :

- **La fraîcheur ne se juge pas sur un calendrier.** Un ETF Euronext consulté
  un mardi a sa dernière clôture au vendredi : le déclarer périmé conduirait à
  le réinterroger sans fin, la place n'ayant rien publié de neuf. D'où
  `instruments.history_checked_at`, qui borne la fréquence des tentatives.
- **Un fournisseur ne remonte pas indéfiniment.** Réclamer l'historique depuis
  2020 alors qu'il ne couvre que 2021 laisse un écart permanent. D'où
  `history_from`, qui mémorise la date la plus ancienne déjà demandée.

Le fournisseur est isolé derrière l'interface `PriceProvider`
(`src/server/prices/provider.ts`) : en changer ne touche pas au métier.

---

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run auth:user` | Crée un compte d'accès (mot de passe saisi masqué) |
| `npm run seed -- --reset` | Jeu de démonstration |
| `npm run db:reset` | Vide le portefeuille, conserve le cache de cours |
| `npm run db:studio` | Explorateur de base Drizzle |
| `npm run check:engine` | Vérifie valorisation et historique en console |

## Données

Tout tient dans un fichier SQLite : `data/portfolio.db` en local,
`/app/data/portfolio.db` dans le conteneur. Il est exclu du dépôt.
