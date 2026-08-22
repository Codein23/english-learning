# Design System — English Learning · Irregular Verbs

Source de vérité visuelle. Registre **product** : le design sert la tâche (répéter, corriger, mesurer). Familiarité gagnée, pas étrangeté décorative.

## Theme

**Encre & papier.** Neutres purs (chroma exactement 0) pour toute l'architecture — fond, surfaces, bordures, texte. Une seule couleur de marque, un rose profond, qui ne sert **jamais** de décor : uniquement sélection courante, liens, focus, progression et emphase. Le caractère vient de la typographie, de la densité et du blanc, pas des aplats.

Stratégie couleur : **Restrained** (accent ≤ 10 % de la surface).

Deux thèmes de premier rang, conçus séparément et testés séparément. Clair par défaut, `prefers-color-scheme` respecté, override manuel persisté dans `#/settings`.

## Color

OKLCH exclusivement. Tokens sémantiques ; jamais de valeur brute dans un composant.

### Neutres — thème clair

| Token | OKLCH | Rôle |
|---|---|---|
| `--color-bg` | `oklch(1 0 0)` | Fond de page. Blanc pur, aucune chaleur cachée. |
| `--color-surface` | `oklch(0.975 0 0)` | Panneaux, lignes alternées, barre latérale. |
| `--color-surface-2` | `oklch(0.945 0 0)` | Survol de ligne, fond de champ, état pressé. |
| `--color-border` | `oklch(0.905 0 0)` | Filets, séparateurs, contours de champ. |
| `--color-border-strong` | `oklch(0.80 0 0)` | Contour de champ au focus, bordure de carte active. |
| `--color-ink` | `oklch(0.17 0 0)` | Texte principal. 14,6:1 sur `bg`. |
| `--color-muted` | `oklch(0.48 0 0)` | Texte secondaire, libellés, placeholders. 4,8:1 sur `bg` — au-dessus du seuil AA texte normal, y compris pour les placeholders. |

### Neutres — thème sombre

| Token | OKLCH | Rôle |
|---|---|---|
| `--color-bg` | `oklch(0.14 0 0)` | Fond de page. Neutre pur, aucune teinte. |
| `--color-surface` | `oklch(0.185 0 0)` | Panneaux, barre latérale. |
| `--color-surface-2` | `oklch(0.23 0 0)` | Survol, champs, état pressé. |
| `--color-border` | `oklch(0.29 0 0)` | Filets et séparateurs — visibles, jamais quasi-invisibles. |
| `--color-border-strong` | `oklch(0.40 0 0)` | Focus de champ, carte active. |
| `--color-ink` | `oklch(0.96 0 0)` | Texte principal. 14:1 sur `bg`. |
| `--color-muted` | `oklch(0.70 0 0)` | Texte secondaire. 7,2:1 sur `bg`. |

### Accent (unique)

Ancre : `oklch(0.48 0.19 343)` — rose profond. Hue fixe à 343° sur les deux thèmes.

| Token | Clair | Sombre | Rôle |
|---|---|---|---|
| `--color-accent` | `oklch(0.48 0.19 343)` | `oklch(0.42 0.17 343)` | Remplissage d'accent (badge de série, barre de progression, pastille de sélection). Texte dessus : `--color-bg` du thème clair, soit blanc — 4,8:1 (clair) / 5,9:1 (sombre). |
| `--color-accent-text` | `oklch(0.48 0.19 343)` | `oklch(0.80 0.13 343)` | Liens, valeur mise en avant, libellé d'état actif. 4,8:1 / 9,3:1. |
| `--color-accent-subtle` | `oklch(0.96 0.02 343)` | `oklch(0.24 0.05 343)` | Fond de zone sélectionnée, ligne courante d'un tableau. |
| `--color-focus` | `oklch(0.48 0.19 343)` | `oklch(0.80 0.13 343)` | Anneau de focus. 2 px + `outline-offset: 2px`, jamais supprimé. |

### Sémantique fonctionnelle

Trois rôles seulement. Toujours doublés d'une icône Lucide **et** d'un libellé texte — la couleur n'est jamais seule porteuse.

| Rôle | Clair | Sombre | Icône obligatoire |
|---|---|---|---|
| `--color-success` | `oklch(0.45 0.14 152)` | texte `oklch(0.78 0.15 152)` | `Check` |
| `--color-danger` | `oklch(0.48 0.19 27)` | texte `oklch(0.75 0.16 25)` | `X` |
| `--color-warning` | `oklch(0.47 0.11 75)` | texte `oklch(0.80 0.13 80)` | `AlertTriangle` |

« Presque — orthographe » (Levenshtein ≤ 1) utilise `warning` + libellé explicite, jamais `success`.

### Groupes Huito

Les dix groupes pédagogiques sont réinterprétés en **chips à faible chroma**, pas en aplats saturés. Même L et C pour tous, seule la teinte change ; le libellé du groupe est toujours écrit dans la chip.

- Clair : fond `oklch(0.945 0.035 H)`, texte `oklch(0.32 0.09 H)` → 7,4:1.
- Sombre : fond `oklch(0.27 0.05 H)`, texte `oklch(0.85 0.09 H)` → 6,9:1.

| Groupe | H | Groupe | H |
|---|---|---|---|
| `RED` | 25 | `GHT` | 265 |
| `LD` | 55 | `GROUP8` | 300 |
| `GEMINI` | 95 | `GROUP9` | 343 |
| `TRIPLETS` | 145 | `OUTSIDERS` | — (chroma 0, neutre) |
| `TEA` | 185 | `null` | — (aucune chip) |
| `GROUP6` | 225 | | |

Les cinq `pattern` (`AAA`/`AAB`/`ABA`/`ABB`/`ABC`) n'utilisent **pas** de couleur : ce sont des étiquettes monospacées en majuscules sur `surface-2`. Deux systèmes de couleur concurrents sur une même ligne de tableau seraient illisibles.

## Typography

Une seule famille : **Archivo Variable** (Omnibus-Type, OFL), auto-hébergée via `@fontsource-variable/archivo` — aucune requête réseau au runtime, condition PWA offline. Grotesque neutre à large amplitude de graisses ; la hiérarchie vient de la graisse et de la taille, pas d'un second caractère.

- Corps : 400. Libellés et boutons : 500. Titres : 600–700. Display de score : 700.
- Échelle **fixe en rem**, ratio ~1.2 (registre product, pas de `clamp()` sur l'UI) : 0.75 / 0.8125 / 0.875 / 1 / 1.125 / 1.375 / 1.75 / 2.25 / 3 rem.
- Corps 16 px minimum sur mobile (évite le zoom auto iOS). `line-height` 1.6 sur la prose, 1.35 sur les titres, 1.2 sur les grands chiffres.
- **Chiffres tabulaires obligatoires** (`font-variant-numeric: tabular-nums`) sur scores, chronos, compteurs, rangs, pourcentages et toute colonne numérique. Un chrono qui gigote pendant le décompte est un bug.
- Les formes anglaises sont rendues en 500/600 et balisées `lang="en"`. L'IPA est en `--color-muted`, taille 0.875 rem.
- `text-wrap: balance` sur h1–h3, `text-wrap: pretty` sur la prose. Prose plafonnée à 68ch ; les tableaux de verbes peuvent aller au-delà.

## Components

Chaque composant interactif livre les sept états : défaut, survol, focus, actif, désactivé, chargement, erreur. Pas de composant à moitié.

- **Boutons.** Rayon 8 px, hauteur 44 px minimum (mobile), 36 px en densité compacte desktop. *Primaire* : fond `ink`, texte `bg` (donc noir/blanc en clair, blanc/noir en sombre) — l'accent n'est pas gaspillé sur les boutons. *Secondaire* : fond `surface`, bordure `border`, texte `ink`. *Discret* : texte seul. *Destructif* : bordure et texte `danger`, confirmation obligatoire.
- **Cartes.** Fond `surface`, bordure 1 px `border`, rayon 12 px, **aucune ombre par défaut**. Jamais de carte imbriquée. Les listes de verbes sont des lignes de tableau, pas des grilles de cartes.
- **Champs.** Libellé visible au-dessus, jamais placeholder seul. Bordure `border` → `border-strong` au focus + anneau `focus`. Erreur affichée sous le champ, avec icône, annoncée en `aria-live="polite"`.
- **Chips / filtres.** Pastille, 32 px de haut, `surface-2` inactif, `accent-subtle` + bordure `accent` actif, avec coche. Cible tactile étendue à 44 px par `padding`.
- **Cartes du mode Association.** Deux tailles de cible seulement ; état verrouillé = bordure `success` + icône `Check` + opacité conservée (jamais grisée au point d'être illisible) ; état erreur = secousse 180 ms, désactivée sous `prefers-reduced-motion` (remplacée par un flash de bordure `danger`).
- **États vides.** Enseignent l'écran, avec une action. « Aucun verbe raté pour l'instant — lance une session pour alimenter cette liste. » Jamais « Rien ici ».
- **Chargement.** Squelettes calqués sur la forme du contenu. Pas de spinner centré au milieu du contenu.
- **Icônes.** Lucide exclusivement, stroke 1.75, tailles 16 / 20 / 24. Jamais d'emoji comme icône.
- **Élévation.** Un seul niveau d'ombre, réservé aux calques flottants (popover, tab bar mobile, lightbox) : `0 8px 24px -8px oklch(0 0 0 / 0.18)` en clair, bordure plus contrastée plutôt qu'ombre en sombre.
- **Échelle z-index sémantique** : `sticky 10` · `tabbar 20` · `dropdown 30` · `overlay 40` · `modal 50` · `toast 60`.

## Layout

- Mobile-first. Breakpoints 375 / 768 / 1024 / 1440.
- **Navigation structurelle** : barre latérale persistante ≥ 1024 px ; tab bar fixe en bas < 1024 px, 5 entrées maximum (Accueil, Verbes, Entraînement, Stats, Réglages), icône **et** libellé, entrée courante marquée par la couleur `accent-text` **et** un indicateur de position.
- Conteneur de contenu `max-width: 1120px`. Prose `max-width: 68ch`.
- Rythme d'espacement 4 px : 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.
- La tab bar mobile réserve son `safe-area-inset-bottom` ; le contenu scrollable reçoit le padding bas correspondant. Aucun contenu masqué derrière un élément fixe.
- Zéro scroll horizontal à 375 px, tableaux compris : sous 768 px, le tableau des verbes bascule en lignes empilées, pas en zone scrollable latérale.
- L'écran de quiz réserve la place du feedback à l'avance : révéler la correction ne doit provoquer aucun décalage de mise en page.

## Motion

`framer-motion`, 150–250 ms, courbes ease-out. La motion porte un état, jamais une décoration.

- Transitions d'état (sélection, verrouillage de paire, apparition de correction) : 180 ms.
- Aucune séquence d'entrée orchestrée au chargement de page : l'utilisateur arrive dans une tâche.
- **Aucune animation ne retarde la question suivante.** Le passage à la question suivante est immédiat ; le feedback s'affiche en parallèle, pas en amont.
- Barre de minuteur : transition linéaire continue, seul cas légitime de `linear`.
- `prefers-reduced-motion: reduce` → toute animation devient un fondu instantané ou est supprimée ; la secousse d'erreur du mode Association est remplacée par un changement de bordure.

## Voice

Français, vouvoiement neutre absent : on s'adresse directement à l'action (« Lancer une session », « Rejouer les erreurs »). Impératif, phrases courtes, aucun point d'exclamation, aucun encouragement automatique. Les chiffres parlent à la place des adjectifs : « 18/25 · 72 % · 4,1 s en moyenne », pas « Bon travail ! ».
