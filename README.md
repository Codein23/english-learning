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

`verbs.json` (180 verbes) est **figé** et copié tel quel dans `src/data/verbs.json`.
Il est validé par un schéma zod (`src/data/schema.ts`) et par `src/data/schema.test.ts`,
qui vérifient en plus :

- l'unicité des identifiants,
- la cohérence `tier` ↔ `rank`,
- la cohérence du `pattern` avec la 1ʳᵉ variante de chaque colonne,
- la couverture complète et sans doublon des 100 rangs du top 100.

### Mettre à jour le dataset

1. Remplacer `verbs.json` à la racine, puis le recopier dans `src/data/verbs.json`.
2. Lancer `npm test` : toute incohérence fait échouer le build avant le déploiement.
3. Documenter l'arbitrage dans `REPORT.md`.

Les champs `ipa` et `example` peuvent rester `null` : ils ne bloquent jamais le rendu.

## Persistance

Clés `el:v1:*` dans `localStorage`, via `src/lib/storage.ts`.
Le stockage indisponible (mode privé, quota) n'interrompt jamais l'application :
un avertissement s'affiche dans `#/settings` et la session continue en mémoire.

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
