# English Learning — Verbes irréguliers

Entraînement intensif aux verbes irréguliers anglais (base / prétérit / participe / traduction FR).
Site statique, sans backend, sans compte, utilisable hors ligne.

**Production** : https://codein23.github.io/english-learning

## Installation

```bash
npm install
npm run dev
```

L'application est servie sous le sous-chemin `/english-learning/` y compris en développement :
ouvrir http://localhost:5173/english-learning/

## Scripts

| Script | Rôle |
|---|---|
| `npm run dev` | Serveur de développement Vite |
| `npm run build` | `tsc --noEmit` puis build de production dans `dist/` |
| `npm run preview` | Sert `dist/` localement |
| `npm run typecheck` | Vérification TypeScript seule |
| `npm test` | Tests Vitest (dataset, scoring, correction) |
| `npm run lint` | ESLint (typé) |
| `npm run format` | Prettier sur `src/` |
| `npm run build:icons` | Régénère les PNG du manifeste PWA depuis `public/favicon.svg` |
| `npm run build:audio` | Construit la banque audio et `manifest.json` (lot audio, à venir) |

## Structure

```
src/
  data/       verbs.json (dataset figé), schéma zod, accès typé
  lib/        storage versionné, statistiques, formatage, groupes Huito
  store/      zustand : réglages + progression (persistés en localStorage)
  components/ AppShell (sidebar desktop / tab bar mobile) et primitives UI
  pages/      une page par route
  styles/     design system (tokens OKLCH, thèmes clair/sombre)
scripts/      outils hors runtime (icônes, audio)
```

Documents de référence à la racine :

- `PRODUCT.md` — registre, utilisateurs, principes de conception, accessibilité
- `DESIGN.md` — tokens, typographie, composants, motion, mise en page
- `REPORT.md` — traçabilité du dataset, conflits arbitrés, pièges pédagogiques

## Dataset

`verbs.json` (438 verbes) est généré par fusion et copié dans `src/data/verbs.json`.
Il est validé par un schéma zod (`src/data/schema.ts`) et par `src/data/schema.test.ts`,
qui vérifient en plus :

- l'unicité des identifiants,
- la cohérence `tier` ↔ `rank`,
- la cohérence du `pattern` avec la 1ʳᵉ variante de chaque colonne,
- la couverture complète et sans doublon des 100 rangs du top 100.

### Composition

| Origine | Verbes |
|---|---|
| Liste exhaustive *by Huito* (`scripts/sources/huito-exhaustive.txt`) | 438 |
| dont métadonnées pédagogiques du tableau coloré (`huitoGroup`) | 108 |
| dont rangs de fréquence englishpage (`rank`, tiers 1 et 2) | 100 |
| Tier 3 (hors top 100, dérivés rares compris) | 338 |

### Mettre à jour le dataset

1. Éditer `scripts/sources/huito-exhaustive.txt` (une ligne par verbe, `base | prétérit | participe | traduction`).
2. `npm run merge:dataset` pour simuler, puis `npm run merge:dataset -- --write` pour appliquer.
   La fusion ne modifie jamais un verbe déjà arbitré : elle conserve son ordre de
   variantes, son groupe, son rang, son tier et sa note, et se contente d'ajouter
   les variantes supplémentaires de la source. Tout est journalisé dans
   `scripts/dataset-report.md`.
3. Lancer `npm test` : toute incohérence fait échouer le build avant le déploiement.
4. Documenter l'arbitrage dans `REPORT.md`.

Les champs `ipa` et `example` peuvent rester `null` : ils ne bloquent jamais le rendu.

## Persistance

Clés `el:v1:*` dans `localStorage`, via `src/lib/storage.ts`.
Le stockage indisponible (mode privé, quota) n'interrompt jamais l'application :
un avertissement s'affiche dans `#/settings` et la session continue en mémoire.

## Banque audio

Trois sources, interrogées en cascade par trois scripts distincts. Chacun est
incrémental : il ne retélécharge jamais ce qui existe, et peut être interrompu.

```bash
npm run build:audio            # 1. Free Dictionary API (MP3 + transcriptions IPA)
npm run build:audio:commons    # 2. Wikimedia Commons par convention de nommage
npm run build:audio:wiktionary # 3. médias référencés par le Wiktionnaire
```

Pourquoi trois passes plutôt qu'une : la Free Dictionary API n'indexe que des
**entrées de dictionnaire**. `eat` existe, `ate` non — or ce sont précisément les
formes fléchies qu'on veut faire entendre. La passe 2 récupère les fichiers
nommés `En-us-ate.ogg` sur Commons ; la passe 3 récupère les enregistrements
**Lingua Libre**, nommés par locuteur (`LL-Q1860 (eng)-Vealhurl-swum.wav`) et donc
impossibles à deviner, mais listés par les pages du Wiktionnaire.

Contraintes découvertes en route, toutes documentées dans `scripts/audio-report.md` :

- l'API limite à ~1 requête/seconde ; au-delà elle ne renvoie que des 429 ;
- son CDN média répond parfois 502, d'où le repli sur les fichiers d'origine ;
- Wikimedia refuse les User-Agent génériques ; le nôtre porte l'URL du projet ;
- les fichiers Commons sont en `.ogg` ou `.wav` : sans ffmpeg, aucune conversion
  n'est possible, donc le manifeste déclare l'extension réelle et le runtime
  retombe sur la synthèse vocale si le navigateur ne sait pas lire le format ;
- la même graphie existe dans d'autres langues — la page « ate » du Wiktionnaire
  référence un fichier **basque**. Seuls les fichiers `LL-Q1860 (eng)` sont retenus.

Le manifeste `public/audio/manifest.json` décrit, pour chaque forme, les fichiers
disponibles par accent (`us`, `uk`, `any`), leur licence et leur auteur. La page
`#/credits` est générée à partir de lui.

## Synchronisation multi-appareils

Optionnelle et désactivée tant que la variable de build `VITE_SYNC_URL` est vide.

Le compte n'est ni un email ni un mot de passe : c'est une **clé de synchronisation**
de 32 octets, générée sur le premier appareil et recopiée sur les suivants. Trois
valeurs en sont dérivées séparément — identifiant de compte, jeton d'authentification,
clé de chiffrement — et la clé elle-même ne quitte jamais le navigateur.

La progression est chiffrée en AES-256-GCM **avant** l'envoi : le serveur stocke un
blob opaque, ne connaît que le SHA-256 du jeton, et ne peut donc ni lire les données
ni retrouver la clé. Perdre la clé sans l'avoir recopiée = perdre l'accès aux données
distantes, définitivement. L'interface le dit au moment où elle affiche la clé.

Deux appareils hors ligne qui divergent sont réconciliés par `src/sync/merge.ts` :
fusion commutative et idempotente, l'entrée la plus récemment vue l'emporte, les
compteurs prennent le maximum, les sessions sont réunies sans doublon. Les favoris
sont réunis — retirer un favori d'un côté ne le retire pas de l'autre, c'est la seule
concession faite à la conservation des données.

Backend : `worker/` (Cloudflare Worker + base D1).

```bash
cd worker && npx wrangler login
```

```bash
npx wrangler d1 create english-learning
```

Reporter le `database_id` obtenu dans `worker/wrangler.toml`, puis :

```bash
npm run db:init && npm run deploy
```

Enfin, déclarer l'URL du Worker comme variable de dépôt pour que le build l'injecte :

```bash
gh variable set SYNC_URL --body "https://english-learning-sync.<sous-domaine>.workers.dev"
```

## Déploiement

Push sur `main` → GitHub Actions (`.github/workflows/deploy.yml`) exécute
lint, typecheck, tests, build, puis publie `dist/` sur GitHub Pages.
Le routeur est en mode hash : aucun rewrite serveur n'est nécessaire
(`public/404.html` reste présent par sécurité).

## Sources

Tableau pédagogique *Irregular verbs by Huito* (groupes pédagogiques) et liste des
100 verbes irréguliers les plus fréquents d'englishpage.com (rangs de fréquence).
Usage strictement personnel, aucune reproduction commerciale.
Aucun asset audio propriétaire n'est utilisé : la banque sonore sera reconstruite
à partir de sources libres (Wikimedia Commons via la Free Dictionary API).
