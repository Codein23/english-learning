/**
 * Vérifie la cohérence entre le manifeste et les fichiers réellement présents.
 *
 * Le runtime construit l'URL d'un enregistrement à partir de l'extension déclarée
 * dans le manifeste. Une extension fausse, un fichier absent ou un fichier orphelin
 * ne produisent aucune erreur visible : le bouton reste muet et retombe sur la
 * synthèse. Ce contrôle rend ces incohérences bruyantes.
 *
 * Usage : node scripts/verify-audio.mjs
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const AUDIO_DIR = path.join(root, 'public', 'audio');
const MANIFEST = path.join(AUDIO_DIR, 'manifest.json');
const DATASET = path.join(root, 'src', 'data', 'verbs.json');

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
const verbs = JSON.parse(await readFile(DATASET, 'utf8'));

const declared = new Set();
const missing = [];
const empty = [];

for (const [form, entry] of Object.entries(manifest.forms)) {
  for (const accent of ['us', 'uk', 'any']) {
    const source = entry[accent];
    if (!source) continue;

    const file = path.join(AUDIO_DIR, accent, `${form}.${source.ext ?? 'mp3'}`);
    declared.add(path.relative(AUDIO_DIR, file).replace(/\\/g, '/'));

    try {
      const info = await stat(file);
      if (info.size < 512) empty.push(`${accent}/${form}`);
    } catch {
      missing.push(`${accent}/${form}.${source.ext ?? 'mp3'}`);
    }
  }
}

/** Fichiers présents sur disque mais absents du manifeste : ils ne seront jamais lus. */
const orphans = [];
for (const accent of ['us', 'uk', 'any']) {
  let files = [];
  try {
    files = await readdir(path.join(AUDIO_DIR, accent));
  } catch {
    continue;
  }
  for (const file of files) {
    const relative = `${accent}/${file}`;
    if (!declared.has(relative)) orphans.push(relative);
  }
}

// Couverture réelle, du point de vue de l'apprenant : par verbe et par tier.
const covered = (form) => {
  const entry = manifest.forms[form.toLowerCase()];
  return Boolean(entry?.us || entry?.uk || entry?.any);
};

const perTier = { 1: { total: 0, full: 0 }, 2: { total: 0, full: 0 }, 3: { total: 0, full: 0 } };
for (const verb of verbs) {
  const forms = [verb.base, verb.past[0], verb.participle[0]].filter(Boolean);
  const bucket = perTier[verb.tier];
  bucket.total += 1;
  if (forms.every((form) => covered(form))) bucket.full += 1;
}

const percent = (value, total) => (total === 0 ? '—' : `${((value / total) * 100).toFixed(1)} %`);

console.log('Cohérence manifeste / disque');
console.log(`  Fichiers déclarés   : ${declared.size}`);
console.log(`  Fichiers manquants  : ${missing.length}`);
console.log(`  Fichiers vides      : ${empty.length}`);
console.log(`  Fichiers orphelins  : ${orphans.length}`);

if (missing.length > 0) console.log(`\nManquants : ${missing.slice(0, 10).join(', ')}`);
if (orphans.length > 0) console.log(`\nOrphelins : ${orphans.slice(0, 10).join(', ')}`);

console.log('\nVerbes dont les trois formes sont enregistrées');
for (const tier of [1, 2, 3]) {
  const bucket = perTier[tier];
  console.log(
    `  Tier ${tier} : ${bucket.full}/${bucket.total} — ${percent(bucket.full, bucket.total)}`,
  );
}

const totalFull = Object.values(perTier).reduce((sum, bucket) => sum + bucket.full, 0);
console.log(`  Global : ${totalFull}/${verbs.length} — ${percent(totalFull, verbs.length)}`);

process.exitCode = missing.length > 0 || empty.length > 0 ? 1 : 0;
