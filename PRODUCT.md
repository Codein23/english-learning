# Product

## Register

product

## Users

Apprenant francophone adulte, seul, en auto-formation. Contexte d'usage dominant : sessions courtes et répétées (5 à 15 minutes) sur téléphone, souvent en déplacement, parfois d'une seule main ; sessions longues occasionnelles sur desktop. Il connaît déjà le principe des verbes irréguliers : il ne cherche pas un cours, il cherche du volume de répétition, mesuré, sans friction et sans compte à créer. Il veut savoir en un coup d'œil ce qu'il maîtrise et ce qu'il rate encore.

## Product Purpose

Application web statique d'entraînement intensif aux verbes irréguliers anglais (base / prétérit / participe passé / traduction FR), sur un dataset de 438 verbes : la liste exhaustive *Irregular verbs by Huito*, enrichie des métadonnées pédagogiques du tableau d'origine (108 verbes avec groupe de couleur) et des rangs de fréquence des *100 Most Common English Irregular Verbs* d'englishpage. Le filtre `tier` est ce qui rend cette masse utilisable : tier 1 et 2 couvrent les 100 verbes réellement fréquents, tier 3 contient le reste, y compris les dérivés rares (`skywrite`, `outspend`) qu'on ne travaille que par curiosité. Neuf modes de quiz, dont un mode Association prioritaire, un moteur de scoring pur et testable, une progression SRS (Leitner 5 boîtes) persistée en `localStorage`, et une banque audio pré-générée depuis des sources libres avec repli Web Speech API. Zéro backend, zéro compte, 100 % offline après première visite (PWA). Succès = l'apprenant revient, ses séries de réussite montent, et sa précision par `pattern` et par `huitoGroup` progresse de façon visible.

## Brand Personality

Sobre, précis, sérieux sans être scolaire. Le ton est celui d'un instrument de travail : phrases courtes, verbes d'action, aucun encouragement infantilisant, aucune célébration gratuite. Trois mots : **net, mesuré, endurant**. L'émotion visée n'est pas la joie, c'est la confiance — l'utilisateur doit sentir que l'outil compte juste et ne triche pas avec lui.

## Anti-references

- **Duolingo et l'edtech gamifiée** : vert acidulé, mascotte, confettis, badges décoratifs, "streak anxiety". La gamification ici se limite au combo du Speed Run et aux boîtes SRS, qui sont des mécaniques de scoring, pas des récompenses.
- **Le template SaaS générique** : dégradé violet/indigo, hero à gros chiffres, cards blanches à ombre douce répétées à l'infini, logos "trusted by".
- **Quizlet / Memrise et l'esthétique "app grand public colorée"** : aplats saturés partout, illustrations stock, couleur comme décor.
- **Les aplats saturés du document Huito d'origine** (rouge, magenta, violet purs) : leur sémantique de groupe est conservée, leur rendu ne l'est pas.
- **Les tableaux de bord "analytics"** : la page Stats sert à réviser mieux, pas à impressionner.

## Design Principles

- **L'outil disparaît derrière la tâche.** Chaque écran a une action primaire évidente. Rien ne s'anime, ne clignote ou ne se déplace si ça retarde la question suivante.
- **La correction enseigne.** Une erreur ne renvoie jamais un simple "faux" : elle montre la forme attendue en clair et affiche systématiquement le champ `note` du verbe quand il existe. C'est le principal moment d'apprentissage de l'application.
- **Le chiffre est lisible et honnête.** Scores, chronos et précisions en chiffres tabulaires, jamais arrondis à l'avantage de l'utilisateur, jamais présentés hors contexte.
- **Le pouce d'abord.** Toute la boucle de quiz est jouable à une main sur 375 px. Le desktop est une extension du mobile, pas l'inverse.
- **Rien ne bloque.** Périmètre trop petit, audio absent, TTS indisponible, `ipa`/`example` à `null` : chaque manque a un comportement dégradé défini. L'application ne plante pas et n'affiche jamais d'état vide muet.

## Accessibility & Inclusion

WCAG 2.2 niveau AA minimum, visé sur les deux thèmes indépendamment. Exigences dures :

- La couleur n'est **jamais** seule porteuse d'information : tout feedback correct/faux et tout `huitoGroup` est doublé d'une icône ou d'un libellé texte (daltonisme).
- Navigation clavier complète, y compris le mode Association (Tab + Entrée), avec focus visible sur les deux thèmes.
- Feedback de quiz annoncé via `aria-live`.
- Cibles tactiles ≥ 44 px, aucun scroll horizontal à 375 px.
- `prefers-reduced-motion` et `prefers-color-scheme` respectés, override manuel du thème dans `#/settings`.
- Interface intégralement en français ; le contenu pédagogique (formes anglaises) est balisé `lang="en"` pour les lecteurs d'écran et la synthèse vocale.
