# PROMPT — Claude Code : site « English Learning — Irregular Verbs » (v3)

> Copier/coller l'intégralité de ce bloc dans Claude Code, à la racine du dossier de travail.
> **Placer `verbs.json` et `REPORT.md` dans le dossier avant de lancer.**

---

## 0. Rôle & cadre

Tu es lead front-end + UX engineer. Tu construis un site statique de A à Z, déployé sur GitHub Pages.

**Skills à activer obligatoirement** : `impeccable` (rigueur d'implémentation, qualité de code, zéro dette) et `ui-ux-pro-max` (direction artistique, hiérarchie visuelle, micro-interactions, accessibilité). Applique-les sur **chaque** écran, pas seulement la home.

**Méthode de travail imposée** :
1. Scaffolding + design system + intégration du dataset fourni.
2. Pages une par une, chacune testable isolément.
3. Commits atomiques, messages conventionnels (`feat:`, `fix:`, `chore:`).
4. À chaque étape : annonce ce que tu fais, ce que tu as vérifié, ce qui reste incertain.

---

## 1. Objectif produit

Application web d'entraînement intensif aux **verbes irréguliers anglais** (base form / preterit / past participle / traduction FR), pensée pour un apprenant francophone adulte qui veut de la répétition efficace, mesurable et rapide sur mobile comme sur desktop.

**URL de production** : `https://codein23.github.io/english-learning`
**Repo** : `codein23/english-learning` (branche `main`, GitHub Pages)

---

## 2. Données — **déjà fournies, ne pas régénérer**

Le dataset consolidé est livré avec ce prompt : **`verbs.json` (180 verbes)** et **`REPORT.md`** (traçabilité, conflits arbitrés, pièges pédagogiques).

Il fusionne le tableau *Irregular verbs by Huito* (108 verbes, groupes pédagogiques colorés) et les *100 Most Common English Irregular Verbs* d'englishpage (couverture 100 %), plus 54 verbes de complétion.

**Ton travail sur la donnée** :
- Copier `verbs.json` dans `src/data/verbs.json`.
- Écrire un schéma **zod** correspondant + un test `vitest` qui échoue si une entrée est invalide.
- Compléter le champ `example` (actuellement `null`) — le champ `ipa` est rempli automatiquement par le script audio du §9, ne le saisis pas à la main : phrase d'exemple courte (≤ 12 mots) employant le **prétérit ou le participe**, pas la base form. Traite-les par lots de 20, en signalant les cas dont tu n'es pas sûr. Ces champs ne doivent jamais bloquer le rendu s'ils restent `null`.
- **Ne modifie aucun autre champ sans me le signaler.**

**Schéma d'une entrée** :

```json
{
  "id": "eat",
  "base": "eat",
  "past": ["ate"],
  "participle": ["eaten"],
  "fr": ["manger"],
  "pattern": "ABC",
  "huitoGroup": "GROUP9",
  "rank": 38,
  "tier": 1,
  "tags": ["huito", "top100"],
  "note": null,
  "ipa": null,
  "example": null
}
```

| Champ | Sémantique |
|---|---|
| `past`, `participle`, `fr` | **Tableaux** de variantes. Toute variante est acceptée en correction (ex. `burnt`/`burned`, `got`/`gotten`). |
| `pattern` | `AAA` (cut/cut/cut), `AAB` (beat/beat/beaten), `ABA` (come/came/come), `ABB` (buy/bought/bought), `ABC` (eat/ate/eaten). Calculé sur la 1ʳᵉ variante. |
| `huitoGroup` | Groupe pédagogique d'origine : `RED`, `LD`, `GEMINI`, `TRIPLETS`, `TEA`, `GROUP6`, `GHT`, `GROUP8`, `GROUP9`, `OUTSIDERS`, ou `null`. À exposer comme filtre, avec un code couleur fidèle au document source. |
| `rank` | Rang de fréquence (1–100) ou `null`. |
| `tier` | 1 = rangs 1–50 · 2 = rangs 51–100 · 3 = hors top 100. Filtre de difficulté. |
| `note` | Piège à afficher en correction : prononciation (`read` [red]), double conjugaison (`hang`, `lie`, `shine`), variante UK/US, confusion `lie`/`lay`. **Obligatoirement affichée dans l'écran de résultat quand le verbe a été raté.** |

---

## 3. Stack technique

- **Vite + React 18 + TypeScript** (`strict: true`)
- **Tailwind CSS** + tokens de design custom (pas de palette Tailwind brute par défaut)
- **React Router en mode hash** (`createHashRouter`) → aucun problème de deep-link sous sous-chemin
- `vite.config.ts` : `base: '/english-learning/'`
- État : `zustand` (store session + store progression) — pas de Redux
- Persistance : `localStorage` via une couche `storage.ts` versionnée (clé `el:v1:*`, migration prévue)
- Animations : `framer-motion`, sobres et courtes (150–250 ms)
- Audio : banque MP3 pré-générée embarquée + repli Web Speech API (cf. §9)
- Tests : `vitest` + `@testing-library/react` sur scoring, génération de questions, correction
- Lint : ESLint + Prettier
- **Zéro backend, zéro compte, 100 % offline** (PWA : manifest + service worker, installable)

---

## 4. Architecture des pages

| Route | Page | Rôle |
|---|---|---|
| `#/` | Accueil | Pitch, CTA « Lancer un entraînement », résumé de progression (streak, verbes maîtrisés, précision 7 j) |
| `#/verbs` | Tableau des verbes | Liste complète, recherche instantanée, filtres (tier, pattern, huitoGroup, tag, maîtrisé/non), tri, audio, favoris |
| `#/verbs/:id` | Fiche verbe | Formes + variantes, IPA, traduction, `note`, exemple, historique perso, CTA « s'entraîner sur ce verbe » |
| `#/quiz` | **Setup de session** | Écran de paramétrage (§5) |
| `#/quiz/run` | Session en cours | Moteur de quiz (§6) |
| `#/quiz/result` | Résultats | Score, précision, temps moyen, erreurs corrigées + `note` affichée, CTA « rejouer les erreurs » |
| `#/stats` | Statistiques | Courbe de précision, heatmap d'assiduité, top 10 des verbes ratés, répartition par `pattern` et `huitoGroup` |
| `#/settings` | Réglages | Thème, accent US/UK, volume, lecture auto, reset, export/import JSON de la progression |
| `#/credits` | Crédits | Attributions des enregistrements audio, générées depuis `manifest.json` |

Navigation : barre latérale sur desktop, tab bar fixe sur mobile.

---

## 5. Écran de setup (exigence forte)

Avant **chaque** lancement. Tous les paramètres sont persistés comme « derniers réglages » et rechargés par défaut, plus 3 presets rapides (`Express 10`, `Standard 25`, `Marathon 50`).

**Paramètres** :
- **Mode(s) de quiz** : sélection multiple (si plusieurs → alternance aléatoire dans la session)
- **Nombre de questions** : 5 / 10 / 15 / 25 / 50 / 100 / personnalisé (slider + input)
- **Minuteur par question** : off / 5 / 10 / 15 / 30 / 60 s / personnalisé — barre de progression circulaire ; dépassement = réponse comptée fausse
- **Minuteur global de session** : off / 2 / 5 / 10 min
- **Périmètre de verbes** : tous / tier 1 / tier 2 / tier 3 / par `pattern` / par `huitoGroup` / favoris / **erreurs passées uniquement** / sélection manuelle
- **Sens de l'interrogation** : EN→EN, FR→EN, EN→FR, mixte
- **Difficulté** : Facile (4 choix, indices actifs) / Normal / Expert (saisie libre, orthographe stricte, sans indice)
- **Options** : audio à l'affichage, indice première lettre, correction immédiate vs. en fin de session, ordre aléatoire, pondération SRS (privilégier les verbes faibles)

Contrainte : si le périmètre contient moins de verbes que le nombre de questions demandé, avertissement clair + choix entre répétition et ajustement automatique. **Ne plante jamais.**

---

## 6. Modes de quiz

### 6.1 Association / Matching — **mode prioritaire, spécifié par le client**

- Affichage simultané d'un lot de N verbes (N paramétrable : 4, 6, 8) : une colonne de **bases**, et un pool mélangé contenant **toutes les formes** (prétérit + participe) de ces verbes.
- L'utilisateur clique la base (`eat`), puis ses formes **dans n'importe quel ordre** : `eaten` puis `ate`, ou `ate` puis `eaten` — les deux sont valides.
- Interactions : **clic-clic obligatoire** (mobile-first) **et** drag & drop. Les deux doivent fonctionner.
- Feedback : liaison correcte → badge coloré persistant + verrouillage de la paire ; erreur → shake court, la carte redevient disponible.
- Le verbe n'est validé que lorsque **les deux formes** sont associées.
- Cas des formes identiques (`cut`/`cut`, `put`/`put`) : le pool doit contenir **deux cartes distinctes**, chacune assignable à un slot. Traite explicitement ce cas, c'est le principal piège d'implémentation.
- Variante Expert : distracteurs issus de verbes hors lot, choisis dans le même `pattern`.

### 6.2 QCM classique
« Participe passé de *to write* ? » → 4 propositions. Distracteurs générés **intelligemment** : formes plausibles du même `pattern`, erreurs de surgénéralisation (*writed*, *goed*), formes de verbes voisins phonétiquement. Jamais aléatoires.

### 6.3 Saisie libre (Expert)
Base donnée, l'utilisateur tape prétérit + participe. Casse ignorée, espaces trimés, toutes variantes acceptées. Distance de Levenshtein ≤ 1 → « presque, orthographe » : compté faux, signalé distinctement.

### 6.4 Complétion de triplet
Une des trois formes est masquée aléatoirement, l'utilisateur complète les deux autres.

### 6.5 Traduction
FR→EN (donner la base) ou EN→FR (choisir la traduction), en QCM ou en saisie. Toute variante du tableau `fr` est acceptée.

### 6.6 Speed Run
Chrono global, flux continu de questions. Score = bonnes réponses ; combo multiplicateur au-delà de 5 réussites d'affilée.

### 6.7 Dictée audio
TTS prononce une forme, l'utilisateur identifie le verbe et/ou tape la forme entendue. Exploite `read`/`said` comme pièges de haut niveau.

### 6.8 Flashcards + SRS
Recto base / verso formes, auto-évaluation 3 niveaux (Encore / Correct / Facile), Leitner 5 boîtes, intervalles 1/2/4/8/16 jours. Alimente la pondération « verbes faibles ».

### 6.9 Tri par pattern
L'utilisateur classe des verbes dans les buckets `AAA` / `AAB` / `ABA` / `ABB` / `ABC`. Variante : tri par `huitoGroup` avec les couleurs du document source.

---

## 7. Moteur & scoring

- Générateur pur, testable, sans effet de bord : `generateSession(config, verbs, progress) => Question[]`
- Correcteur pur : `checkAnswer(question, input) => { correct, kind, expected, note }`
- Score : 100 pts de base, bonus rapidité (jusqu'à +50 si réponse < 30 % du temps imparti), malus indice (−25)
- Par verbe : `attempts`, `correct`, `lastSeen`, `box` (SRS), `avgMs`. « Maîtrisé » = 3 réussites consécutives sans indice **et** `box ≥ 4`
- Résultats : précision globale, précision par `pattern` et par `huitoGroup`, temps moyen, erreurs avec correction en clair + `note`, bouton « refaire uniquement ces verbes »

---

## 8. Direction artistique (skill `ui-ux-pro-max`)

- Identité propre, **pas de template générique** : pas de dégradé violet/indigo par défaut, pas de card blanche à ombre douce partout.
- Direction proposée : typographie éditoriale à fort contraste de graisse (display serif ou grotesque condensée en titrage, sans-serif neutre en corps), palette resserrée à 2 teintes + 1 accent sémantique, beaucoup d'espace négatif, **chiffres tabulaires** pour scores et chronos.
- Les couleurs des `huitoGroup` sont un héritage du document source : réinterprète-les en teintes accessibles plutôt que de reprendre les aplats saturés d'origine (rouge/magenta/violet purs).
- Feedback couleur strictement sémantique et **jamais seul porteur d'information** : toujours doublé d'une icône ou d'un libellé (daltonisme).
- Dark mode natif, `prefers-color-scheme` respecté, override manuel. `prefers-reduced-motion` respecté.
- **Mobile-first** : cibles tactiles ≥ 44 px, aucun scroll horizontal, quiz jouable au pouce d'une main.
- Accessibilité : navigation clavier complète sur le mode Association (Tab + Entrée), `aria-live` pour le feedback, focus visible, contraste AA minimum.
- Micro-interactions courtes, jamais bloquantes : aucune animation ne doit retarder la question suivante.

---

## 9. Audio & prononciation — exigence forte

Objectif : chaque forme (base, prétérit, participe) doit être **écoutable individuellement**, avec une qualité et une ergonomie comparables à un dictionnaire en ligne — bouton haut-parleur discret accolé à la forme, lecture instantanée, accent sélectionnable.

### 9.1 Contrainte juridique — à respecter strictement

Les fichiers audio de WordReference sont propriétaires. **Interdiction absolue de les scraper, hotlinker ou rejouer.** Le modèle de référence est l'**ergonomie**, pas les fichiers. On reconstruit une banque sonore à partir de sources libres.

### 9.2 Architecture en cascade (3 niveaux)

**Niveau 1 — Banque audio pré-générée, embarquée dans le repo (source principale)**

- Un script Node `scripts/build-audio.mjs`, exécuté **hors runtime**, constitue la banque.
- Il travaille sur les **formes uniques**, pas sur les verbes : le dataset compte 606 occurrences de formes mais seulement **426 chaînes uniques** (`cut` n'est enregistré qu'une fois et sert aux trois colonnes). Dédupliquer est obligatoire.
- Sources, dans cet ordre :
  1. **Free Dictionary API** (`https://api.dictionaryapi.dev/api/v2/entries/en/<forme>`) → champ `phonetics[].audio` : enregistrements humains hébergés par Wiktionary/Wikimedia Commons, licences CC. Récupère aussi `phonetics[].text` → **remplit le champ `ipa` du dataset**, ce qui règle le TODO du §2.
  2. **Wikimedia Commons** en repli direct pour les formes absentes de l'API.
- Sortie : `public/audio/<accent>/<forme>.mp3` (`accent` ∈ `us`, `uk`), normalisée en volume, mono, ~32 kbps. Budget attendu : **< 3 Mo pour les deux accents**.
- Sortie annexe : `public/audio/manifest.json` — pour chaque forme, disponibilité par accent, URL source, licence, auteur. Sert à la fois au runtime (savoir si un fichier existe) et à la page d'attributions.
- Le script est **idempotent et incrémental** : il ne retélécharge pas ce qui existe, journalise les échecs dans `scripts/audio-report.md`.

**Niveau 2 — Web Speech API (repli runtime)**

Pour toute forme sans fichier : `speechSynthesis` avec voix `en-US`/`en-GB` selon le réglage, `rate: 0.9`. Repli silencieux et sans erreur visible si l'API est indisponible.

**Niveau 3 — Aucun audio**

Le bouton haut-parleur est masqué (pas désactivé, pas grisé) si ni fichier ni TTS ne sont disponibles. **L'absence d'audio ne doit jamais bloquer un quiz.**

### 9.3 Pièges à traiter explicitement

- **Homographes hétérophones** : `read` (base [riːd] / prétérit-participe [red]), `lead` [liːd] vs `led` [led], `wind` (verbe [waɪnd] ≠ nom [wɪnd]), `tear` [teə] vs `tore`. Le nom de fichier ne peut donc pas être la seule clé.
  → La clé d'audio est **`<forme>__<rôle>`** (`read__base`, `read__past`), et le dataset gagne un champ optionnel `audioKey` par colonne quand la forme par défaut ne convient pas. Le script doit vérifier manuellement ces cas et les lister dans `audio-report.md`.
- **Variantes UK/US** : `burnt`/`burned`, `got`/`gotten`, `dreamt`/`dreamed` — chaque variante a son propre fichier, l'accent sélectionné détermine celle qui est proposée par défaut à l'écoute.
- **Formes identiques dans un triplet** (`cut`, `put`, `set`) : un seul fichier, trois boutons.

### 9.4 Runtime

- Hook unique `useAudio()` : gère la cascade, le préchargement, l'accent courant, un cache mémoire des `Audio` déjà instanciés.
- **Débounce et interruption** : un nouveau clic coupe la lecture en cours, jamais de superposition.
- **Déblocage iOS** : `AudioContext` initialisé sur la première interaction utilisateur, sinon le son est muet sur Safari mobile. À tester réellement.
- Service worker : les fichiers audio sont mis en cache à la demande (stratégie `cache-first`), pas préchargés en masse au premier chargement.
- Réglage global dans `#/settings` : accent US/UK, volume, **lecture automatique** (au dévoilement d'une réponse) on/off.

### 9.5 Intégration UI

| Emplacement | Comportement |
|---|---|
| Fiche verbe `#/verbs/:id` | Bouton haut-parleur sur chacune des trois formes + IPA affichée à côté |
| Tableau `#/verbs` | Bouton compact par ligne (base uniquement), plus un bouton « écouter le triplet » qui enchaîne les trois formes avec 400 ms de pause |
| Quiz — correction | Lecture automatique de la bonne forme si l'option est active ; bouton toujours présent |
| Mode Dictée audio (§6.7) | Source obligatoire de niveau 1 ou 2 ; le mode est masqué au setup si aucune n'est disponible |

### 9.6 Attributions

Page `#/credits` listant, à partir de `manifest.json`, les licences et auteurs des enregistrements Wikimedia. Lien depuis le footer. Obligatoire pour les licences CC-BY / CC-BY-SA.

---

## 10. Déploiement

- Workflow GitHub Actions `.github/workflows/deploy.yml` : build sur push `main` → publication GitHub Pages.
- `base: '/english-learning/'` : vérifie que favicon, manifest, icônes PWA et `verbs.json` résolvent sous ce sous-chemin.
- Router en hash → `404.html` non nécessaire, mais ajoute-le par sécurité.
- `README.md` : installation, scripts, structure, procédure de mise à jour du dataset.
- Mention de source dans le footer : tableau pédagogique *by Huito* et liste de fréquence *englishpage.com*. Usage strictement personnel, aucune reproduction commerciale.

---

## 11. Critères d'acceptation

- [ ] `verbs.json` intégré tel quel, schéma zod validé par un test
- [ ] Les 9 modes de quiz sont jouables de bout en bout
- [ ] Le mode Association accepte l'ordre libre des formes — **test unitaire dédié**
- [ ] Le mode Association gère les verbes à formes identiques (`cut`, `put`, `set`) — **test unitaire dédié**
- [ ] Toutes les variantes (`burnt`/`burned`, `got`/`gotten`) sont acceptées en correction — **test unitaire dédié**
- [ ] Le champ `note` s'affiche systématiquement sur un verbe raté qui en possède un
- [ ] Tous les paramètres du §5 sont fonctionnels et persistés
- [ ] Le minuteur par question expire correctement et compte la réponse fausse
- [ ] `scripts/build-audio.mjs` produit la banque audio + `manifest.json` + `audio-report.md`
- [ ] Couverture audio ≥ 90 % des 426 formes uniques, écarts listés dans `audio-report.md`
- [ ] Repli TTS effectif sur toute forme sans fichier, repli silencieux si TTS absent
- [ ] Homographes `read`, `lead`/`led`, `wind`, `tear` prononcés correctement selon le rôle — **vérification à l'oreille obligatoire**
- [ ] Audio fonctionnel sur Safari iOS après première interaction
- [ ] Champ `ipa` rempli par le script pour ≥ 90 % des formes
- [ ] Page `#/credits` générée depuis `manifest.json`
- [ ] Aucun asset provenant de WordReference ou d'une source propriétaire
- [ ] Progression persistée, export/import JSON opérationnel
- [ ] Build sans warning, `tsc --noEmit` clean, lint clean
- [ ] Lighthouse ≥ 95 en Performance / Accessibilité / Best Practices sur mobile
- [ ] Site fonctionnel hors ligne après première visite
- [ ] Testé à 375 px, 768 px et 1440 px

---

## 12. Hors périmètre

Pas de backend, pas d'authentification, pas de synchronisation multi-appareils, pas d'IA générative à l'exécution, pas de tracking analytics tiers.

---

## 13. Livraison

Commence par le scaffolding + design system + intégration de `verbs.json`, puis **arrête-toi pour validation visuelle** avant de développer les modes de quiz.
