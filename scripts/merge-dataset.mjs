/**
 * Fusionne la liste exhaustive (`scripts/sources/huito-exhaustive.txt`) avec le
 * dataset existant, sans jamais écraser silencieusement une donnée arbitrée.
 *
 * Règles :
 *  - un verbe déjà présent conserve ses formes, sa traduction, son `huitoGroup`,
 *    son `rank`, son `tier`, ses `tags`, sa `note`, son `ipa` et son `example` ;
 *    les divergences avec la source sont listées dans le rapport, pas appliquées ;
 *  - un verbe absent du dataset est ajouté en `tier: 3`, `rank: null`,
 *    `huitoGroup: null`, tag `exhaustive` ;
 *  - un verbe présent dans le dataset mais absent de la source est conservé
 *    (il vient du top 100 englishpage) et signalé.
 *
 * Sortie : `verbs.json` + `src/data/verbs.json` + `scripts/dataset-report.md`.
 * Usage : node scripts/merge-dataset.mjs [--write]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const SOURCE = path.join(root, 'scripts', 'sources', 'huito-exhaustive.txt');
const DATASET = path.join(root, 'src', 'data', 'verbs.json');

const write = process.argv.includes('--write');

function computePattern(base, past, participle) {
  const b = base.toLowerCase();
  const p = (past ?? '').toLowerCase();
  const pp = (participle ?? '').toLowerCase();
  if (b === p && p === pp) return 'AAA';
  if (b === p && p !== pp) return 'AAB';
  if (b !== p && b === pp) return 'ABA';
  if (b !== p && p === pp) return 'ABB';
  return 'ABC';
}

const split = (value) =>
  value
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

const raw = await readFile(SOURCE, 'utf8');
const sourceRows = raw
  .split(/\r?\n/)
  .filter((line) => line.trim() !== '' && !line.startsWith('#'))
  .map((line, index) => {
    const [base, past, participle, fr] = line.split('|').map((part) => part.trim());
    if (!base || !past || !participle || !fr) {
      throw new Error(`Ligne ${index + 1} incomplète : ${line}`);
    }
    return {
      id: base.toLowerCase(),
      base: base.toLowerCase(),
      past: split(past).map((value) => value.toLowerCase()),
      participle: split(participle).map((value) => value.toLowerCase()),
      fr: fr.split(',').map((value) => value.trim()),
    };
  });

const duplicates = sourceRows
  .map((row) => row.id)
  .filter((id, index, all) => all.indexOf(id) !== index);
if (duplicates.length > 0) {
  throw new Error(`Doublons dans la source : ${[...new Set(duplicates)].join(', ')}`);
}

const existing = JSON.parse(await readFile(DATASET, 'utf8'));
const existingById = new Map(existing.map((verb) => [verb.id, verb]));
const sourceById = new Map(sourceRows.map((row) => [row.id, row]));

const divergences = [];
const added = [];

const merged = [];

for (const row of sourceRows) {
  const previous = existingById.get(row.id);

  if (!previous) {
    added.push(row.id);
    merged.push({
      id: row.id,
      base: row.base,
      past: row.past,
      participle: row.participle,
      fr: row.fr,
      pattern: computePattern(row.base, row.past[0], row.participle[0]),
      huitoGroup: null,
      rank: null,
      tier: 3,
      tags: ['exhaustive'],
      note: null,
      ipa: null,
      example: null,
    });
    continue;
  }

  // Le verbe existe : l'ordre du dataset fait foi (la 1ʳᵉ variante détermine le
  // `pattern`), mais toute variante supplémentaire de la source est ajoutée en
  // fin de liste : refuser une forme valide en correction serait un défaut.
  const union = (field) => {
    const kept = previous[field];
    const extras = row[field].filter(
      (value) => !kept.some((current) => current.toLowerCase() === value.toLowerCase()),
    );
    if (extras.length > 0) {
      divergences.push({
        id: row.id,
        field,
        dataset: kept.join('/'),
        source: row[field].join('/'),
        addition: extras.join('/'),
      });
    }
    return [...kept, ...extras];
  };

  merged.push({
    ...previous,
    past: union('past'),
    participle: union('participle'),
    tags: previous.tags.includes('exhaustive')
      ? previous.tags
      : [...previous.tags, 'exhaustive'],
  });
}

// Verbes du dataset absents de la liste exhaustive : conservés tels quels.
const keptOutsideSource = existing
  .filter((verb) => !sourceById.has(verb.id))
  .map((verb) => verb.id);
for (const id of keptOutsideSource) {
  const verb = existingById.get(id);
  if (verb) merged.push(verb);
}

merged.sort((a, b) => a.base.localeCompare(b.base));

const byPattern = merged.reduce((acc, verb) => {
  acc[verb.pattern] = (acc[verb.pattern] ?? 0) + 1;
  return acc;
}, {});
const byTier = merged.reduce((acc, verb) => {
  acc[verb.tier] = (acc[verb.tier] ?? 0) + 1;
  return acc;
}, {});

const report = `# Rapport de fusion du dataset

Généré par \`scripts/merge-dataset.mjs\`. Ne pas éditer à la main.

| Indicateur | Valeur |
|---|---|
| Verbes après fusion | **${merged.length}** |
| Lignes de la source exhaustive | ${sourceRows.length} |
| Verbes déjà présents, conservés tels quels | ${sourceRows.length - added.length} |
| Verbes ajoutés par la source | ${added.length} |
| Verbes conservés hors source (top 100 englishpage) | ${keptOutsideSource.length} |

## Répartition par schéma

${Object.entries(byPattern)
  .sort()
  .map(([pattern, count]) => `- \`${pattern}\` : ${count}`)
  .join('\n')}

## Répartition par tier

${Object.entries(byTier)
  .sort()
  .map(([tier, count]) => `- Tier ${tier} : ${count}`)
  .join('\n')}

## Variantes ajoutées depuis la source

L'ordre du dataset est conservé — la 1ʳᵉ variante détermine le \`pattern\` — et les
formes supplémentaires de la source sont ajoutées en fin de liste, donc acceptées
en correction. Les simples différences d'ordre ne figurent pas ici.

${
  divergences.length === 0
    ? '_Aucune._'
    : `| Verbe | Champ | Dataset | Source | Ajouté |\n|---|---|---|---|---|\n${divergences
        .map(
          (d) =>
            `| \`${d.id}\` | ${d.field} | ${d.dataset} | ${d.source} | **${d.addition}** |`,
        )
        .join('\n')}`
}

## Verbes conservés hors liste exhaustive

${keptOutsideSource.length === 0 ? '_Aucun._' : keptOutsideSource.map((id) => `\`${id}\``).join(' · ')}

## Verbes ajoutés

${added.map((id) => `\`${id}\``).join(' · ')}
`;

console.log(`Source        : ${sourceRows.length} lignes`);
console.log(`Dataset avant : ${existing.length} verbes`);
console.log(`Ajoutés       : ${added.length}`);
console.log(`Hors source   : ${keptOutsideSource.length}`);
console.log(`Dataset après : ${merged.length} verbes`);
console.log(`Divergences   : ${divergences.length}`);

if (!write) {
  console.log('\nSimulation seule. Relancer avec --write pour appliquer.');
} else {
  const json = `${JSON.stringify(merged, null, 2)}\n`;
  await writeFile(DATASET, json, 'utf8');
  await writeFile(path.join(root, 'verbs.json'), json, 'utf8');
  await writeFile(path.join(root, 'scripts', 'dataset-report.md'), report, 'utf8');
  console.log('\nÉcrit : src/data/verbs.json, verbs.json, scripts/dataset-report.md');
}
