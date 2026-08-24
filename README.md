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

## Données

Tout est stocké dans `data/portfolio.db` (SQLite). Sauvegarder revient à copier
ce fichier. Il est exclu du dépôt par `.gitignore`.
