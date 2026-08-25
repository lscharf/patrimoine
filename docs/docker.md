# Déploiement Docker

Guide d'exploitation de l'application patrimoniale en auto-hébergement.

L'image est construite en trois étapes (`deps`, `builder`, `runner`) à partir de
`node:22-bookworm-slim`. La base Debian est un choix délibéré : `better-sqlite3`
est un module natif lié à la glibc, et Alpine (musl) obligerait à embarquer
toute la chaîne de compilation dans l'image finale.

---

## 1. Premier démarrage

```bash
cd /chemin/vers/finances

# 1. Configuration
cp .env.example .env

# 2. Générer la clé de signature des sessions et la coller dans .env
openssl rand -base64 32

# 3. Éditer .env : BETTER_AUTH_SECRET, BETTER_AUTH_URL, AUTH_ALLOWED_EMAILS
#    et les trois variables AUTHELIA_*
$EDITOR .env

# 4. Construire et démarrer
docker compose up -d --build

# 5. Vérifier
docker compose ps
curl -s http://127.0.0.1:3000/api/health
```

Réponse attendue :

```json
{ "status": "ok", "uptime": 12, "version": "0.1.0" }
```

Les migrations SQL sont appliquées automatiquement au démarrage du serveur : il
n'y a aucune commande de migration à lancer à la main, ni au premier démarrage
ni lors des mises à jour.

### Reverse proxy obligatoire

Le port est publié sur `127.0.0.1:3000` et **jamais** sur `0.0.0.0`. Le
conteneur ne parle que du HTTP en clair et doit se trouver derrière un proxy qui
termine le TLS :

- les cookies de session sont marqués `Secure` : un navigateur les refuse sur
  une origine `http://`, la connexion échoue alors en boucle sans message
  d'erreur explicite ;
- les URL de rappel OIDC enregistrées dans Authelia sont en `https://` et
  doivent correspondre au caractère près.

Le proxy doit transmettre les en-têtes `X-Forwarded-Proto` et
`X-Forwarded-Host`. `BETTER_AUTH_URL` doit valoir l'URL publique vue par le
navigateur (par exemple `https://patrimoine.example.com`), pas
`http://localhost:3000`.

`docker-compose.yml` contient un bloc commenté montrant comment rattacher le
service à un réseau Docker externe déjà utilisé par un proxy, avec des libellés
Traefik donnés à titre d'exemple.

---

## 2. Variables d'environnement

Toutes sont lues depuis `.env` au démarrage. Aucune n'est inscrite dans l'image.

| Variable | Rôle |
|---|---|
| `PORTFOLIO_DB_PATH` | Chemin du fichier SQLite dans le conteneur. Doit rester sous `/app/data` (le volume persistant). |
| `BETTER_AUTH_SECRET` | Clé de signature des sessions, 32 octets minimum (`openssl rand -base64 32`). La changer déconnecte tout le monde. |
| `BETTER_AUTH_URL` | URL publique HTTPS de l'application. Sert à construire les rappels OIDC. |
| `AUTH_ALLOWED_EMAILS` | Liste blanche d'adresses séparées par des virgules. Toute autre identité est refusée même si Authelia l'authentifie. |
| `AUTHELIA_ISSUER` | URL de base d'Authelia, sans barre oblique finale. |
| `AUTHELIA_CLIENT_ID` | Identifiant du client OIDC déclaré dans Authelia. |
| `AUTHELIA_CLIENT_SECRET` | Secret partagé du client OIDC. |

Variables déjà positionnées dans l'image, à ne modifier qu'en connaissance de
cause : `NODE_ENV=production`, `HOSTNAME=0.0.0.0`, `PORT=3000`.

`APP_VERSION` est un argument de construction (`build.args`), pas une variable
d'exécution : il n'est repris que dans la réponse de `/api/health`.

Après toute modification de `.env` :

```bash
docker compose up -d
```

---

## 3. Où vivent les données

Tout est dans le volume nommé `patrimoine-data`, monté sur `/app/data` :

| Fichier | Contenu |
|---|---|
| `portfolio.db` | La base elle-même. |
| `portfolio.db-wal` | Journal d'écriture anticipée (WAL). Peut contenir des transactions déjà validées. |
| `portfolio.db-shm` | Mémoire partagée d'index du WAL. Reconstructible. |

Emplacement réel sur l'hôte :

```bash
docker volume inspect patrimoine-data --format '{{ .Mountpoint }}'
```

Le volume survit à `docker compose down` et à toute reconstruction de l'image.
Il n'est détruit que par `docker compose down -v` — **cette commande efface le
portefeuille**.

Le répertoire `/app/data` est créé et attribué à l'utilisateur `node` (uid 1000)
dans l'image, ce qui permet à Docker d'initialiser un volume nommé neuf avec le
bon propriétaire. Ce mécanisme ne fonctionne **que** pour les volumes nommés :
en remplaçant le volume par un montage lié (`- ./data:/app/data`), il faut
attribuer le répertoire à la main sur l'hôte, sinon le conteneur ne peut pas
écrire :

```bash
sudo chown -R 1000:1000 ./data
```

---

## 4. Sauvegarde

### Le piège du WAL

La base tourne en mode WAL. Les transactions validées sont d'abord écrites dans
`portfolio.db-wal` et ne sont recopiées dans `portfolio.db` qu'au moment d'un
*checkpoint*. **Copier uniquement `portfolio.db` pendant que le serveur tourne
produit donc une sauvegarde silencieusement incomplète**, sans le moindre
message d'erreur.

L'écart n'a rien de théorique. Sur cette base, un `portfolio.db` de 412 Ko
correspondait à une sauvegarde cohérente de 1,1 Mo : la majorité des données
récentes se trouvait encore dans le WAL.

Trois méthodes correctes, de la plus pratique à la plus radicale.

### Méthode A — sauvegarde à chaud (recommandée)

L'API de sauvegarde en ligne de SQLite produit un fichier unique et cohérent,
WAL inclus, sans arrêter le service. `better-sqlite3` est déjà présent dans
l'image, donc rien à installer :

```bash
docker compose exec patrimoine node -e "
const D = require('better-sqlite3');
const db = new D(process.env.PORTFOLIO_DB_PATH, { readonly: true });
db.backup('/app/data/sauvegarde.db').then(() => { db.close(); console.log('ok'); });
"

# Récupérer le fichier sur l'hôte, puis le retirer du volume
docker compose cp patrimoine:/app/data/sauvegarde.db ./patrimoine-$(date +%F).db
docker compose exec patrimoine rm /app/data/sauvegarde.db
```

Le fichier obtenu est autonome : ni `-wal` ni `-shm` à conserver à côté.

Vérifier une sauvegarde avant de s'y fier :

```bash
sqlite3 ./patrimoine-$(date +%F).db "pragma integrity_check;"   # doit répondre : ok
```

### Méthode B — client `sqlite3` sur l'hôte

Si l'outil `sqlite3` est installé sur la machine hôte, la même sauvegarde en
ligne s'obtient directement sur le fichier du volume :

```bash
DATA=$(docker volume inspect patrimoine-data --format '{{ .Mountpoint }}')
sudo sqlite3 "$DATA/portfolio.db" ".backup '/var/backups/patrimoine-$(date +%F).db'"
```

Utiliser `.backup`, et surtout pas `cp`.

### Méthode C — arrêt du conteneur

La méthode la plus simple à auditer : serveur arrêté, plus aucune écriture en
cours.

```bash
docker compose stop patrimoine

DATA=$(docker volume inspect patrimoine-data --format '{{ .Mountpoint }}')
sudo tar czf patrimoine-$(date +%F).tar.gz -C "$DATA" .

docker compose start patrimoine
```

Ici l'archive doit contenir `portfolio.db` **et** ses fichiers `-wal` et `-shm`.
Le `-C "$DATA" .` s'en charge : ne jamais extraire du lot le seul `.db`.

### Restauration

```bash
docker compose stop patrimoine
DATA=$(docker volume inspect patrimoine-data --format '{{ .Mountpoint }}')

# Écarter l'état courant plutôt que l'écraser
sudo mv "$DATA/portfolio.db" "$DATA/portfolio.db.avant-restauration"
sudo rm -f "$DATA/portfolio.db-wal" "$DATA/portfolio.db-shm"

sudo cp ./patrimoine-2026-08-25.db "$DATA/portfolio.db"
sudo chown 1000:1000 "$DATA/portfolio.db"

docker compose start patrimoine
```

Supprimer les anciens `-wal` et `-shm` est indispensable : laissés en place à
côté d'une base restaurée, ils corrompent la lecture. Le `chown 1000:1000`
rétablit le propriétaire attendu par le conteneur.

---

## 5. Mise à jour

```bash
cd /chemin/vers/finances

# 0. Sauvegarder d'abord (méthode A ci-dessus) — une migration ne se rejoue pas
#    à l'envers.

# 1. Récupérer le nouveau code
git pull

# 2. Reconstruire et relancer
docker compose up -d --build

# 3. Contrôler
docker compose logs -f --tail=50 patrimoine
curl -s http://127.0.0.1:3000/api/health
```

Le volume n'est pas touché : les données sont conservées et les nouvelles
migrations s'appliquent seules au démarrage.

Pour marquer une version dans `/api/health` :

```bash
docker compose build --build-arg APP_VERSION=0.2.0
docker compose up -d
```

Revenir en arrière consiste à repasser sur le commit précédent puis à
reconstruire — en gardant à l'esprit qu'une migration déjà appliquée ne sera pas
défaite, d'où la sauvegarde préalable.

Nettoyage des couches d'images devenues inutiles :

```bash
docker image prune -f
```

Ne jamais utiliser `docker system prune --volumes`, qui emporterait la base.

---

## 6. Journaux et diagnostic

```bash
# Suivre en direct
docker compose logs -f patrimoine

# Les 200 dernières lignes
docker compose logs --tail=200 patrimoine

# Depuis un instant donné
docker compose logs --since 30m patrimoine

# Filtrer
docker compose logs patrimoine | grep -i "error\|migration"
```

Les journaux sont plafonnés à 3 fichiers de 10 Mo (pilote `json-file`), ils ne
peuvent donc pas remplir le disque.

### État de la sonde de santé

```bash
docker inspect --format '{{ .State.Health.Status }}' patrimoine
docker inspect --format '{{ json .State.Health }}' patrimoine
```

La sonde interroge `/api/health` toutes les 30 s. Cette route ne consulte
délibérément pas la base : elle reste verte pendant une migration longue, ce qui
évite un cycle de redémarrages qui interromprait justement cette migration.
Une base en panne se diagnostique donc dans les journaux, pas via la sonde.

### Ouvrir un shell dans le conteneur

```bash
docker compose exec patrimoine sh
```

Le conteneur tourne sous l'utilisateur non privilégié `node`. Ni `sqlite3`, ni
`tsx`, ni `drizzle-kit` n'y sont installés : pour interroger la base en SQL,
passer par `node -e` et `require('better-sqlite3')`, ou copier le fichier sur
l'hôte.

### Symptômes courants

| Symptôme | Cause probable |
|---|---|
| `SQLITE_CANTOPEN` / `EACCES` au démarrage | `/app/data` n'appartient pas à l'uid 1000. Typique d'un montage lié : `sudo chown -R 1000:1000` sur le répertoire hôte. |
| Application accessible mais tables absentes | Le répertoire `drizzle/` manque dans l'image ; les migrations n'ont rien trouvé à appliquer. |
| Boucle de redirection à la connexion | `BETTER_AUTH_URL` ne correspond pas à l'URL publique, ou le proxy ne termine pas le TLS. |
| Page sans style ni interactivité | `.next/static` absent de l'image. |
| `Cannot find module ... better_sqlite3.node` | Binaire natif absent pour l'architecture : reconstruire sans cache (`docker compose build --no-cache`). |
