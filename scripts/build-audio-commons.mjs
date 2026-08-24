/**
 * Deuxième passe de construction de la banque audio : Wikimedia Commons en direct.
 *
 * Pourquoi une deuxième passe ? La Free Dictionary API n'indexe que des **entrées
 * de dictionnaire** : `eat` existe, `ate` non. Or ce sont précisément les formes
 * fléchies qu'on veut faire entendre. Commons, lui, héberge les enregistrements
 * sous une convention de nommage stable — `En-us-ate.ogg` — qu'on peut interroger
 * directement, 50 titres par requête.
 *
 * Cette passe ne touche qu'aux formes encore dépourvues d'audio après la première.
 * Elle complète le même `manifest.json` et n'écrase jamais un fichier existant.
 *
 * Usage : node scripts/build-audio-commons.mjs [--limit N] [--dry-run]
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const DATASET = path.join(root, 'src', 'data', 'verbs.json');
const AUDIO_DIR = path.join(root, 'public', 'audio');
const MANIFEST = path.join(AUDIO_DIR, 'manifest.json');
const REPORT = path.join(root, 'scripts', 'audio-report.md');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex === -1 ? Infinity : Number(args[limitIndex + 1] ?? Infinity);

const COMMONS = 'https://commons.wikimedia.org/w/api.php';
/**
 * Wikimedia impose un User-Agent identifiable : un agent générique reçoit 429
 * sur `upload.wikimedia.org`. On y met l'URL du projet, et rien d'autre —
 * surtout pas l'adresse de l'utilisateur, qui n'a pas à circuler chez un tiers.
 */
const UA = 'english-learning-audio-builder/1.0 (https://codein23.github.io/english-learning/)';
const BATCH = 50;
const DELAY_MS = 900;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

/**
 * Conventions de nommage rencontrées sur Commons, par ordre de préférence.
 * `En-us-…` domine, mais `En-uk-…`, `En-gb-…` et le `.wav` non compressé existent.
 */
function candidates(form, accent) {
  const prefixes = accent === 'us' ? ['En-us'] : ['En-uk', 'En-gb'];
  const extensions = ['ogg', 'wav', 'mp3'];
  return prefixes.flatMap((prefix) =>
    extensions.map((extension) => `File:${prefix}-${form}.${extension}`),
  );
}

/** Interroge Commons par lots de 50 titres : existence, URL, auteur et licence. */
async function lookup(titles) {
  const url =
    `${COMMONS}?action=query&prop=imageinfo&iiprop=url%7Cextmetadata&format=json&origin=*` +
    `&titles=${encodeURIComponent(titles.join('|'))}`;

  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!response.ok) throw new Error(`Commons HTTP ${response.status}`);

  const data = await response.json();
  const pages = Object.values(data.query?.pages ?? {});
  const found = new Map();
  const strip = (value) => (value ?? '').replace(/<[^>]+>/g, '').trim();

  for (const page of pages) {
    if (page.missing !== undefined) continue;
    const info = page.imageinfo?.[0];
    if (!info?.url) continue;
    found.set(page.title, {
      url: info.url.split('?')[0],
      title: page.title,
      author: strip(info.extmetadata?.Artist?.value) || null,
      license: strip(info.extmetadata?.LicenseShortName?.value) || null,
      licenseUrl: strip(info.extmetadata?.LicenseUrl?.value) || null,
      sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
    });
  }
  return found;
}

async function download(url, destination, attempt = 1) {
  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  // Wikimedia limite le débit : on ralentit et on réessaie plutôt qu'abandonner.
  if (response.status === 429 && attempt <= 4) {
    await sleep(3000 * attempt);
    return download(url, destination, attempt + 1);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 512) throw new Error(`fichier suspect (${buffer.length} octets)`);
  await writeFile(destination, buffer);
  return buffer.length;
}

// ---------------------------------------------------------------------------

const verbs = JSON.parse(await readFile(DATASET, 'utf8'));
const manifest = (await exists(MANIFEST))
  ? JSON.parse(await readFile(MANIFEST, 'utf8'))
  : { forms: {} };

const forms = new Map();
const addForm = (form, role, verbId) => {
  const key = form.toLowerCase();
  const record = forms.get(key) ?? { form: key, roles: new Set(), verbs: new Set() };
  record.roles.add(role);
  record.verbs.add(verbId);
  forms.set(key, record);
};

for (const verb of verbs) {
  addForm(verb.base, 'base', verb.id);
  for (const past of verb.past) addForm(past, 'past', verb.id);
  for (const participle of verb.participle) addForm(participle, 'participle', verb.id);
}

const tierOf = new Map(verbs.map((verb) => [verb.id, verb.tier]));
const priorityOf = (record) => Math.min(...[...record.verbs].map((id) => tierOf.get(id) ?? 3));

/** Formes encore sans aucun enregistrement, les plus fréquentes d'abord. */
const pending = [...forms.values()]
  .filter((record) => {
    const entry = manifest.forms[record.form];
    return !entry?.us && !entry?.uk;
  })
  .sort((a, b) => priorityOf(a) - priorityOf(b) || a.form.localeCompare(b.form))
  .slice(0, Number.isFinite(limit) ? limit : undefined);

const alreadyCovered = [...forms.values()].filter((record) => {
  const entry = manifest.forms[record.form];
  return Boolean(entry?.us || entry?.uk);
}).length;

console.log(`Formes totales          : ${forms.size}`);
console.log(`Déjà pourvues en audio  : ${alreadyCovered}`);
console.log(`À chercher sur Commons  : ${pending.length}`);

await mkdir(path.join(AUDIO_DIR, 'us'), { recursive: true });
await mkdir(path.join(AUDIO_DIR, 'uk'), { recursive: true });

// Un titre candidat → la forme et l'accent qu'il représente.
const titleMap = new Map();
for (const record of pending) {
  for (const accent of ['us', 'uk']) {
    for (const title of candidates(record.form, accent)) {
      titleMap.set(title, { form: record.form, accent, roles: [...record.roles] });
    }
  }
}

const allTitles = [...titleMap.keys()];
console.log(`Titres candidats        : ${allTitles.length} (${Math.ceil(allTitles.length / BATCH)} requêtes)`);

let downloaded = 0;
let failed = 0;
const found = new Map();

for (let offset = 0; offset < allTitles.length; offset += BATCH) {
  const batch = allTitles.slice(offset, offset + BATCH);
  try {
    const results = await lookup(batch);
    for (const [title, info] of results) {
      const target = titleMap.get(title);
      if (!target) continue;
      const key = `${target.form}|${target.accent}`;
      // Premier candidat trouvé = meilleure extension selon l'ordre de préférence.
      if (!found.has(key)) found.set(key, { ...info, ...target });
    }
  } catch (error) {
    console.log(`  lot ${offset / BATCH + 1} échoué : ${String(error)}`);
  }

  if ((offset / BATCH) % 10 === 0) {
    console.log(`  ${offset + batch.length}/${allTitles.length} titres · ${found.size} trouvés`);
  }
  await sleep(DELAY_MS);
}

console.log(`\nEnregistrements trouvés : ${found.size}`);

for (const [key, info] of found) {
  const [form, accent] = key.split('|');
  const ext = (info.url.split('.').pop() ?? 'ogg').toLowerCase();
  const destination = path.join(AUDIO_DIR, accent, `${form}.${ext}`);

  if (dryRun) continue;
  if (await exists(destination)) continue;

  try {
    const bytes = await download(info.url, destination);
    downloaded += 1;
    const entry = manifest.forms[form] ?? { ipa: null, roles: info.roles };
    entry[accent] = {
      url: info.url,
      sourceUrl: info.sourceUrl,
      title: info.title,
      author: info.author,
      license: info.license,
      licenseUrl: info.licenseUrl,
      ext,
      bytes,
    };
    manifest.forms[form] = entry;
  } catch (error) {
    failed += 1;
    if (failed <= 5) console.log(`  échec ${form} (${accent}) : ${String(error)}`);
  }

  if (downloaded % 25 === 0 && downloaded > 0) {
    console.log(`  ${downloaded} fichiers téléchargés…`);
    if (!dryRun) await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }
  await sleep(800);
}

const entries = Object.values(manifest.forms);
const withAudio = entries.filter((entry) => entry.us || entry.uk).length;
const withUs = entries.filter((entry) => entry.us).length;
const withUk = entries.filter((entry) => entry.uk).length;
const coverage = (value) => `${((value / forms.size) * 100).toFixed(1)} %`;

if (!dryRun) {
  manifest.generatedAt = new Date().toISOString();
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  // Le rapport de la première passe est complété, pas remplacé.
  const previous = (await exists(REPORT)) ? await readFile(REPORT, 'utf8') : '';
  const addition = `

## Deuxième passe — Wikimedia Commons en direct

La Free Dictionary API n'indexe que des entrées de dictionnaire : \`eat\` existe,
\`ate\` non. Cette passe interroge Commons par convention de nommage
(\`En-us-<forme>.ogg\`), ce qui couvre justement les formes fléchies.

| Indicateur | Valeur |
|---|---|
| Formes interrogées | ${pending.length} |
| Enregistrements trouvés | ${found.size} |
| Fichiers téléchargés | ${downloaded} |
| Échecs de téléchargement | ${failed} |

### Couverture après les deux passes

| Indicateur | Valeur |
|---|---|
| Formes uniques | ${forms.size} |
| Avec au moins un enregistrement | ${withAudio} — ${coverage(withAudio)} |
| Accent américain | ${withUs} — ${coverage(withUs)} |
| Accent britannique | ${withUk} — ${coverage(withUk)} |
`;
  await writeFile(REPORT, previous + addition, 'utf8');
}

console.log(`Téléchargés : ${downloaded} · échecs : ${failed}`);
console.log(`Couverture finale : ${withAudio}/${forms.size} (${coverage(withAudio)})`);
