/**
 * Applique les phrases d'exemple au dataset, en les **vérifiant** d'abord.
 *
 * Deux règles du §2 sont contrôlées automatiquement, parce qu'une phrase qui les
 * enfreint est pire qu'une absence de phrase : elle enseigne le contraire de ce
 * qu'on veut. Une phrase rejetée n'est jamais écrite dans le dataset.
 *
 *   1. douze mots maximum ;
 *   2. la phrase contient une forme de prétérit ou de participe du verbe,
 *      et pas seulement sa base verbale.
 *
 * Usage : node scripts/apply-examples.mjs [--write]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const DATASET = path.join(root, 'src', 'data', 'verbs.json');
const SOURCE = path.join(root, 'scripts', 'sources', 'examples.txt');

const write = process.argv.includes('--write');
const MAX_WORDS = 12;

const verbs = JSON.parse(await readFile(DATASET, 'utf8'));
const byId = new Map(verbs.map((verb) => [verb.id, verb]));

const raw = await readFile(SOURCE, 'utf8');
const rows = raw
  .split(/\r?\n/)
  .filter((line) => line.trim() !== '' && !line.startsWith('#'))
  .map((line) => {
    const separator = line.indexOf('|');
    return {
      id: line.slice(0, separator).trim(),
      sentence: line.slice(separator + 1).trim(),
    };
  });

const words = (sentence) => sentence.split(/\s+/).filter(Boolean);

/** Mots de la phrase, sans ponctuation, en minuscules. */
const tokens = (sentence) =>
  words(sentence).map((word) => word.replace(/[^a-zA-Z'-]/g, '').toLowerCase());

const accepted = [];
const rejected = [];

for (const row of rows) {
  const verb = byId.get(row.id);
  if (!verb) {
    rejected.push({ ...row, reason: 'identifiant inconnu dans le dataset' });
    continue;
  }

  const count = words(row.sentence).length;
  if (count > MAX_WORDS) {
    rejected.push({ ...row, reason: `${count} mots (maximum ${MAX_WORDS})` });
    continue;
  }

  const present = tokens(row.sentence);
  const inflected = [...verb.past, ...verb.participle].map((form) => form.toLowerCase());
  const hasInflected = inflected.some((form) => present.includes(form));

  if (!hasInflected) {
    rejected.push({
      ...row,
      reason: `aucune forme fléchie trouvée (attendu : ${inflected.join(', ')})`,
    });
    continue;
  }

  // Cas particulier utile : pour un verbe AAA (cut/cut/cut) la base et les formes
  // fléchies sont identiques, la vérification ci-dessus ne prouve donc rien.
  // On le signale sans rejeter — c'est une limite du contrôle, pas une erreur.
  const ambiguous = verb.pattern === 'AAA';

  accepted.push({ ...row, ambiguous });
}

const updated = verbs.map((verb) => {
  const match = accepted.find((row) => row.id === verb.id);
  return match ? { ...verb, example: match.sentence } : verb;
});

const withExample = updated.filter((verb) => verb.example !== null).length;
const ambiguous = accepted.filter((row) => row.ambiguous);

console.log(`Phrases lues     : ${rows.length}`);
console.log(`Acceptées        : ${accepted.length}`);
console.log(`Rejetées         : ${rejected.length}`);
console.log(`Verbes avec exemple : ${withExample}/${verbs.length}`);

if (ambiguous.length > 0) {
  console.log(
    `\n${ambiguous.length} verbes AAA : la vérification automatique ne peut pas distinguer` +
      ' la base de la forme fléchie, relecture humaine nécessaire.',
  );
  console.log(ambiguous.map((row) => `  ${row.id} — ${row.sentence}`).join('\n'));
}

if (rejected.length > 0) {
  console.log('\nRejets :');
  for (const row of rejected) console.log(`  ${row.id} — ${row.reason}\n    « ${row.sentence} »`);
}

if (!write) {
  console.log('\nSimulation seule. Relancer avec --write pour appliquer.');
} else {
  const json = `${JSON.stringify(updated, null, 2)}\n`;
  await writeFile(DATASET, json, 'utf8');
  await writeFile(path.join(root, 'verbs.json'), json, 'utf8');
  console.log('\nÉcrit : src/data/verbs.json, verbs.json');
}

process.exitCode = rejected.length > 0 ? 1 : 0;
