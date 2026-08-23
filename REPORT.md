# Rapport de construction du dataset — `verbs.json`

> **Mise à jour — passage à 438 verbes.**
> Le dataset a été étendu avec la liste exhaustive du PDF
> *Irregular verbs Huito tableau final UPDATED* (438 lignes), transcrite dans
> `scripts/sources/huito-exhaustive.txt` et fusionnée par `scripts/merge-dataset.mjs`.
> Les 180 verbes ci-dessous en font tous partie et **conservent intégralement**
> leurs métadonnées : groupe Huito, rang, tier, note pédagogique, ordre des variantes.
> Les 258 verbes ajoutés sont en `tier: 3`, `rank: null`, `huitoGroup: null`,
> tag `exhaustive`. Le détail chiffré est dans `scripts/dataset-report.md`.
>
> **Écarts assumés par rapport au PDF source :**
> - 16 variantes supplémentaires du PDF ont été **ajoutées** aux verbes existants
>   (`bade`, `bidden`, `hid`, `shined`, `shrunken`, `slayed`, `awakened`, `waked`,
>   `broadcasted`, `weaved`) : refuser une forme valide en correction serait un défaut.
>   L'ordre du dataset est conservé, donc le `pattern` calculé ne change pas.
> - `read` : la mention `[red]` du PDF a été retirée des colonnes de formes — c'est
>   une indication de prononciation, pas une orthographe. Elle est déjà portée par
>   le champ `note` et sera reprise par le champ `ipa`.
> - Une dizaine de traductions du PDF étaient des noms ou des libellés tronqués
>   (`Inlay → « Incrustation »`, `Input → « Entrée »`, `Outbreed → « Surélever »`,
>   `Outleap → « Sauter loin »`…). Elles ont été rendues à l'infinitif et complétées
>   (`Incruster`, `Saisir`, `Croiser hors lignée`, `Sauter plus loin que`), sans quoi
>   les modes de traduction auraient posé des questions incorrectes.

## Bilan

| Indicateur | Valeur |
|---|---|
| Verbes total | **180** |
| Issus du tableau Huito | 108 |
| Issus du top 100 englishpage | 100 (couverture 100 %) |
| Présents dans les deux sources | 82 |
| Présents uniquement dans le top 100 | 18 |
| Ajoutés hors sources (complétion) | 54 |
| Doublons détectés | 0 |

## Répartition par pattern morphologique

| Pattern | Exemple | Nombre |
|---|---|---|
| `ABB` | buy / bought / bought | 85 |
| `ABC` | eat / ate / eaten | 64 |
| `AAA` | cut / cut / cut | 26 |
| `ABA` | come / came / come | 4 |
| `AAB` | beat / beat / beaten | 1 |

## Répartition par tier (fréquence)

- **Tier 1** — rangs 1 à 50 du top 100 : 50 verbes
- **Tier 2** — rangs 51 à 100 : 50 verbes
- **Tier 3** — hors top 100 : 80 verbes

## Groupes pédagogiques Huito conservés

`RED` (5) · `LD` (3) · `GEMINI` (20) · `TRIPLETS` (17) · `TEA` (19) · `GROUP6` (7) · `GHT` (7) · `GROUP8` (8) · `GROUP9` (14) · `OUTSIDERS` (8)

Ces groupes sont conservés en tant que `huitoGroup` et exposés comme filtre dans l'application, en parallèle du `pattern` calculé automatiquement.

## Verbes présents uniquement dans le top 100 englishpage (18)

`bear, beat, cast, lay, prove, ride, speak, speed, spend, swear, sweat, swing, take, tear, wake, wear, wet, write`

## Verbes ajoutés hors sources (54)

`arise, awake, bid, bind, breed, cling, dive, dwell, flee, fling, forecast, foresee, forgive, forsake, kneel, knit, lean, leap, learn, mislead, misunderstand, mow, overcome, overhear, oversee, overtake, rebuild, repay, retell, rewrite, rid, sew, shed, shine, slay, sling, sow, spell, stink, stride, strive, swell, thrive, thrust, tread, undergo, undertake, uphold, wed, weep, weave, wind, withhold, withstand`

## Conflits et arbitrages

| Verbe | Conflit | Arbitrage |
|---|---|---|
| `get` | Huito : *got / got-gotten (USA)* — englishpage : *gotten* | `participle: ["got", "gotten"]`, note US ajoutée |
| `strike` | Huito : *struck* — englishpage : *stricken* | `participle: ["struck", "stricken"]`, note sur l'usage figuré de *stricken* |
| `bear` | englishpage : *born* | `participle: ["borne", "born"]`, note : *born* réservé à la naissance |
| `beat` | Participe *beaten* / *beat* | `["beaten", "beat"]` |
| `show`, `prove`, `mow`, `sew`, `sow`, `swell` | Participe fort ou faible | Les deux variantes acceptées |
| `spit` | Huito : *spat/spit* | Les deux acceptées, note sur l'usage américain |

## Pièges signalés via le champ `note`

- **Homographes/prononciation** : `read` (prétérit et participe prononcés [red]), `say` → *said* [sed], `wind` (verbe ≠ nom *wind*)
- **Verbes à double conjugaison selon le sens** : `hang` (hung / hanged), `lie` (lay-lain / lied), `shine` (shone / shined)
- **Confusion classique** : `lay` (poser) vs. prétérit de `lie` (être étendu) — les deux sont dans le dataset, la note l'explicite
- **Variantes UK/US** : `burn`, `dream`, `smell`, `spell`, `spill`, `spoil`, `learn`, `lean`, `leap`, `kneel`, `dwell`, `dive`

## Champs volontairement laissés à `null`

`ipa` et `example` — absents des deux sources. À compléter par Claude Code, avec relecture obligatoire. Non bloquants pour le fonctionnement de l'application.
