# Progression — English Learning

## Lot 1 — scaffolding + design system + dataset (terminé, en attente de validation visuelle)

- [x] Vite 8 + React 18 + TypeScript `strict` (+ `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- [x] Tailwind v4 avec tokens custom, thèmes clair/sombre séparés, aucune palette Tailwind brute
- [x] `verbs.json` copié tel quel dans `src/data/`, schéma zod, 19 tests verts
- [x] Persistance versionnée `el:v1:*`, stores zustand réglages + progression
- [x] Shell : sidebar desktop / tab bar mobile, skip link, thème appliqué avant premier paint
- [x] Pages réelles : Accueil, Tableau des verbes, Fiche verbe, Réglages
- [x] Placeholders honnêtes : Entraînement, Stats, Crédits (aucun lien mort)
- [x] PWA (manifest, service worker, audio en cache-first), icônes générées
- [x] Workflow GitHub Actions : lint → typecheck → test → build → Pages
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` : tous verts, zéro warning

### Vérifié
- Contrastes mesurés dans le navigateur, thèmes clair **et** sombre : ink/bg 19:1 et 17,8:1,
  muted/bg 6,6:1 et 7,4:1, texte blanc sur accent 7,3:1 et 9,3:1, chips de groupe ≥ 9:1.
- Aucune erreur console au chargement.

### Non vérifié
- Rendu visuel à 375 / 768 / 1440 px : le panneau navigateur n'était pas affiché,
  aucune capture n'a pu être prise. À contrôler avant de démarrer le lot 2.

## Lot 2 — moteur de quiz (à venir)

Générateur pur `generateSession`, correcteur pur `checkAnswer`, écran de setup complet (§5),
puis les neuf modes en commençant par Association (§6.1) avec ses tests dédiés :
ordre libre des formes, formes identiques (`cut`/`put`/`set`), variantes acceptées.

## Lot 3 — audio

`scripts/build-audio.mjs` (426 formes uniques, dédupliquées), remplissage du champ `ipa`,
clés `<forme>__<rôle>` pour les homographes, repli Web Speech API, page `#/credits`.

## Lot 4 — complétion des champs `example` et passe qualité

Phrases d'exemple par lots de 20, Lighthouse mobile ≥ 95, test hors ligne, Safari iOS.
