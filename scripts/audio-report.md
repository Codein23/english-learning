# Rapport de construction de la banque audio

Généré par `scripts/build-audio.mjs` le 24/08/2026 14:10:21.
Ne pas éditer à la main.

## Couverture

| Indicateur | Valeur |
|---|---|
| Occurrences de formes dans le dataset | 1518 |
| Formes uniques (ce qui est réellement téléchargé) | 1048 |
| Formes avec au moins un enregistrement | 193 — 18.4 % |
| Formes avec accent américain | 170 — 16.2 % |
| Formes avec accent britannique | 42 — 4.0 % |
| Formes avec transcription phonétique | 439 — 41.9 % |
| Verbes dont le champ `ipa` est renseigné | 200 / 438 |
| Fichiers téléchargés lors de cette exécution | 110 |
| Formes réutilisées sans retéléchargement | 89 |

## Homographes hétérophones — vérification à l'oreille obligatoire

Ces formes ne peuvent pas être résolues automatiquement : le dictionnaire renvoie
la prononciation du nom ou d'un autre sens. Elles restent sur la synthèse vocale
tant qu'un enregistrement correct n'a pas été choisi manuellement.

- **wind** — Le verbe se prononce [waɪnd], le nom [wɪnd] : le dictionnaire renvoie le nom.
- **tear** — Le verbe se prononce [teə], le nom (larme) [tɪə].
- **lead** — Le verbe se prononce [liːd], le métal [led]. Le prétérit « led » est correct.
- **live** — Le verbe [lɪv] et l’adjectif [laɪv] partagent la même graphie.
- **bow** — Deux prononciations selon le sens.
- **sow** — Le verbe [səʊ] et la truie [saʊ] partagent la même graphie.
- **wound** — Prétérit de wind [waʊnd] ≠ blessure [wuːnd].

Substitutions volontaires déjà appliquées :

- `read__past` → enregistrement de « red » (prétérit de read se prononce [red])
- `read__participle` → enregistrement de « red » (participe de read se prononce [red])

## Échecs

1015 formes sans enregistrement exploitable.

| Forme | Cause |
|---|---|
| `be` | not_found |
| `did` | no_audio |
| `done` | no_audio |
| `drove` | network_error |
| `hung` | no_audio |
| `meant` | download_us |
| `meant` | no_audio |
| `meet` | download_uk |
| `put` | download_us |
| `put` | no_audio |
| `ran` | download_us |
| `ran` | no_audio |
| `read` | download_us |
| `read` | download_uk |
| `read` | no_audio |
| `read__past` | download_us |
| `read__past` | no_audio |
| `read__participle` | download_us |
| `read__participle` | no_audio |
| `run` | download_us |
| `run` | no_audio |
| `said` | no_audio |
| `show` | download_uk |
| `showed` | no_audio |
| `sit` | download_us |
| `sit` | no_audio |
| `speak` | download_us |
| `speak` | download_uk |
| `speak` | no_audio |
| `spend` | download_us |
| `spend` | no_audio |
| `spent` | network_error |
| `spoke` | download_us |
| `spoke` | no_audio |
| `stand` | download_us |
| `stand` | no_audio |
| `stood` | download_us |
| `stood` | no_audio |
| `take` | download_us |
| `take` | download_uk |
| `take` | no_audio |
| `taken` | download_us |
| `taken` | download_uk |
| `taken` | no_audio |
| `tell` | download_us |
| `tell` | no_audio |
| `think` | download_us |
| `think` | no_audio |
| `took` | download_us |
| `took` | no_audio |
| `was` | not_found |
| `went` | download_us |
| `went` | no_audio |
| `were` | no_audio |
| `write` | download_uk |
| `written` | download_us |
| `written` | no_audio |
| `wrote` | download_us |
| `wrote` | no_audio |
| `bear` | download_us |
| `bear` | no_audio |
| `beat` | download_us |
| `beat` | no_audio |
| `beaten` | download_us |
| `beaten` | no_audio |
| `bet` | download_us |
| `bet` | no_audio |
| `betted` | no_audio |
| `bite` | download_us |
| `bite` | no_audio |
| `bitten` | download_uk |
| `bitten` | no_audio |
| `blew` | download_us |
| `blew` | no_audio |
| `blow` | network_error |
| `blown` | download_us |
| `blown` | no_audio |
| `bore` | download_us |
| `bore` | no_audio |
| `born` | download_us |
| `born` | no_audio |
| `build` | download_us |
| `build` | download_uk |
| `build` | no_audio |
| `built` | download_us |
| `built` | no_audio |
| `burst` | download_us |
| `burst` | no_audio |
| `cast` | download_us |
| `cast` | no_audio |
| `choose` | download_us |
| `choose` | no_audio |
| `chose` | download_us |
| `chose` | no_audio |
| `chosen` | no_audio |
| `deal` | download_us |
| `deal` | no_audio |
| `dealt` | http_error |
| `dig` | download_us |
| `dig` | no_audio |
| `draw` | no_audio |
| `drawn` | download_us |
| `drawn` | no_audio |
| `drew` | download_us |
| `drew` | no_audio |
| `drink` | download_us |
| `drink` | no_audio |
| `drunk` | download_us |
| `drunk` | no_audio |
| `dug` | download_uk |
| `dug` | no_audio |
| `fit` | download_us |
| `fit` | no_audio |
| `flew` | download_us |
| `flew` | no_audio |
| `fought` | download_us |
| `fought` | no_audio |
| `freeze` | download_us |
| `freeze` | no_audio |
| `froze` | download_uk |
| `froze` | no_audio |
| `frozen` | download_us |
| `frozen` | no_audio |
| `grew` | download_us |
| `grew` | no_audio |
| `grow` | download_us |
| `grow` | no_audio |
| `grown` | download_us |
| `grown` | no_audio |
| `hid` | download_us |
| `hid` | no_audio |
| `hide` | network_error |
| `laid` | download_us |
| `laid` | no_audio |
| `lain` | download_us |
| `lain` | no_audio |
| `lay` | network_error |
| `lead` | download_us |
| `lead` | no_audio |
| `led` | download_us |
| `led` | no_audio |
| `lie` | download_us |
| `lie` | no_audio |
| `pay` | download_us |
| `pay` | no_audio |
| `proven` | no_audio |
| `ridden` | no_audio |
| `ride` | download_us |
| `ride` | no_audio |
| `rose` | download_uk |
| `rose` | no_audio |
| `rung` | download_us |
| `rung` | no_audio |
| `sang` | download_us |
| `sang` | no_audio |
| `sank` | download_us |
| `sank` | no_audio |
| `sell` | download_us |
| `sell` | no_audio |
| `sing` | download_us |
| `sing` | download_uk |
| `sing` | no_audio |
| `sink` | download_us |
| `sink` | download_uk |
| `sink` | no_audio |
| `sleep` | download_us |
| `sleep` | no_audio |
| `speeded` | no_audio |
| `stolen` | download_us |
| `stolen` | no_audio |
| `strike` | download_us |
| `strike` | no_audio |
| `struck` | download_us |
| `struck` | no_audio |
| `stuck` | download_us |
| `stuck` | no_audio |
| `sung` | download_us |
| `sung` | no_audio |
| `swam` | download_us |
| `swam` | no_audio |
| `sweated` | http_error |
| `swim` | download_us |
| `swim` | no_audio |
| `swing` | download_us |
| `swing` | no_audio |
| `sworn` | download_us |
| `sworn` | no_audio |
| `swum` | download_uk |
| `swum` | no_audio |
| `swung` | download_us |
| `swung` | no_audio |
| `taught` | download_us |
| `taught` | download_uk |
| `taught` | no_audio |
| `teach` | download_us |
| `teach` | no_audio |
| `tear` | no_audio |
| `threw` | download_us |
| `threw` | no_audio |
| `tore` | download_uk |


## Deuxième passe — Wikimedia Commons en direct

La Free Dictionary API n'indexe que des entrées de dictionnaire : `eat` existe,
`ate` non. Cette passe interroge Commons par convention de nommage
(`En-us-<forme>.ogg`), ce qui couvre justement les formes fléchies.

| Indicateur | Valeur |
|---|---|
| Formes interrogées | 30 |
| Enregistrements trouvés | 28 |
| Fichiers téléchargés | 6 |
| Échecs de téléchargement | 22 |

### Couverture après les deux passes

| Indicateur | Valeur |
|---|---|
| Formes uniques | 1046 |
| Avec au moins un enregistrement | 199 — 19.0 % |
| Accent américain | 176 — 16.8 % |
| Accent britannique | 42 — 4.0 % |


## Deuxième passe — Wikimedia Commons en direct

La Free Dictionary API n'indexe que des entrées de dictionnaire : `eat` existe,
`ate` non. Cette passe interroge Commons par convention de nommage
(`En-us-<forme>.ogg`), ce qui couvre justement les formes fléchies.

| Indicateur | Valeur |
|---|---|
| Formes interrogées | 25 |
| Enregistrements trouvés | 22 |
| Fichiers téléchargés | 10 |
| Échecs de téléchargement | 12 |

### Couverture après les deux passes

| Indicateur | Valeur |
|---|---|
| Formes uniques | 1046 |
| Avec au moins un enregistrement | 209 — 20.0 % |
| Accent américain | 186 — 17.8 % |
| Accent britannique | 42 — 4.0 % |


## Deuxième passe — Wikimedia Commons en direct

La Free Dictionary API n'indexe que des entrées de dictionnaire : `eat` existe,
`ate` non. Cette passe interroge Commons par convention de nommage
(`En-us-<forme>.ogg`), ce qui couvre justement les formes fléchies.

| Indicateur | Valeur |
|---|---|
| Formes interrogées | 20 |
| Enregistrements trouvés | 15 |
| Fichiers téléchargés | 15 |
| Échecs de téléchargement | 0 |

### Couverture après les deux passes

| Indicateur | Valeur |
|---|---|
| Formes uniques | 1046 |
| Avec au moins un enregistrement | 224 — 21.4 % |
| Accent américain | 201 — 19.2 % |
| Accent britannique | 42 — 4.0 % |


## Deuxième passe — Wikimedia Commons en direct

La Free Dictionary API n'indexe que des entrées de dictionnaire : `eat` existe,
`ate` non. Cette passe interroge Commons par convention de nommage
(`En-us-<forme>.ogg`), ce qui couvre justement les formes fléchies.

| Indicateur | Valeur |
|---|---|
| Formes interrogées | 822 |
| Enregistrements trouvés | 209 |
| Fichiers téléchargés | 209 |
| Échecs de téléchargement | 0 |

### Couverture après les deux passes

| Indicateur | Valeur |
|---|---|
| Formes uniques | 1046 |
| Avec au moins un enregistrement | 427 — 40.8 % |
| Accent américain | 400 — 38.2 % |
| Accent britannique | 52 — 5.0 % |


## Troisième passe — médias du Wiktionnaire (Lingua Libre)

Les enregistrements Lingua Libre sont nommés par locuteur
(`LL-Q1860 (eng)-Vealhurl-swum.wav`) et échappaient donc aux conventions
testées par la deuxième passe. Le Wiktionnaire les référence page par page.

Filtre de langue : seuls les fichiers `LL-Q1860 (eng)` sont retenus. La page
« ate » référence aussi un fichier **basque** (`LL-Q8752 (eus)`) ; sans ce
filtre l'application ferait prononcer les verbes dans la mauvaise langue.

| Indicateur | Valeur |
|---|---|
| Formes interrogées | 40 |
| Médias repérés | 26 |
| Médias résolus sur Commons | 26 |
| Fichiers téléchargés | 26 |
| Échecs | 0 |
| **Couverture après les trois passes** | **453 / 1046 — 43.3 %** |

Les enregistrements Lingua Libre ne déclarent pas leur accent : ils sont rangés
sous `any` et servis en dernier recours, avant la synthèse vocale.


## Troisième passe — médias du Wiktionnaire (Lingua Libre)

Les enregistrements Lingua Libre sont nommés par locuteur
(`LL-Q1860 (eng)-Vealhurl-swum.wav`) et échappaient donc aux conventions
testées par la deuxième passe. Le Wiktionnaire les référence page par page.

Filtre de langue : seuls les fichiers `LL-Q1860 (eng)` sont retenus. La page
« ate » référence aussi un fichier **basque** (`LL-Q8752 (eus)`) ; sans ce
filtre l'application ferait prononcer les verbes dans la mauvaise langue.

| Indicateur | Valeur |
|---|---|
| Formes interrogées | 593 |
| Médias repérés | 233 |
| Médias résolus sur Commons | 233 |
| Fichiers téléchargés | 233 |
| Échecs | 0 |
| **Couverture après les trois passes** | **686 / 1046 — 65.6 %** |

Les enregistrements Lingua Libre ne déclarent pas leur accent : ils sont rangés
sous `any` et servis en dernier recours, avant la synthèse vocale.
