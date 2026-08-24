/**
 * Troisième passe : les fichiers référencés par les pages du Wiktionnaire anglais.
 *
 * Les deux premières passes manquaient les enregistrements **Lingua Libre**, qui
 * ne suivent pas la convention `En-us-<forme>.ogg` mais un nommage par locuteur :
 * `LL-Q1860 (eng)-Vealhurl-swum.wav`. Impossible à deviner, mais le Wiktionnaire
 * les liste : `prop=images` sur la page d'une forme renvoie ses médias.
 *
 * Piège traité explicitement : la même graphie existe dans d'autres langues.
 * La page « ate » référence aussi `LL-Q8752 (eus)-…-ate.wav`, qui est du **basque**.
 * Seuls les fichiers portant le code de langue anglais (Q1860) sont retenus —
 * sans ce filtre, l'application ferait prononcer les verbes en basque.
 *
 * Usage : node scripts/build-audio-wiktionary.mjs [--limit N] [--dry-run]
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

const WIKTIONARY = 'https://en.wiktionary.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const UA = 'english-learning-audio-builder/1.0 (https://codein23.github.io/english-learning/)';
const BATCH = 50;
const DELAY_MS = 900;

/** Q1860 = anglais dans Wikidata. Tout autre code de langue est écarté. */
const ENGLISH_LINGUA_LIBRE = /^File:LL-Q1860 \(eng\)-/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function api(endpoint, params) {
  const url = `${endpoint}?${new URLSearchParams({ format: 'json', ...params }).toString()}`;
  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * Classe un fichier média par accent à partir de son nom.
 * `any` couvre les enregistrements Lingua Libre, dont l'accent n'est pas
 * déclaré dans le titre : mieux vaut une voix humaine d'accent inconnu qu'une
 * voix de synthèse, et le runtime le signale comme dernier recours.
 */
function classify(title, form) {
  const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`^File:en-us-${escaped}\\.(ogg|mp3|wav|flac)$`, 'i').test(title)) return 'us';
  if (new RegExp(`^File:en-(uk|gb)-${escaped}\\.(ogg|mp3|wav|flac)$`, 'i').test(title)) return 'uk';
  if (ENGLISH_LINGUA_LIBRE.test(title) && title.toLowerCase().endsWith(`-${form}.wav`)) {
    return 'any';
  }
  return null;
}

async function download(url, destination, attempt = 1) {
  const response = await fetch(url, { headers: { 'User-Agent': UA } });
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

const pending = [...forms.values()]
  .filter((record) => {
    const entry = manifest.forms[record.form];
    return !entry?.us && !entry?.uk && !entry?.any;
  })
  .sort((a, b) => priorityOf(a) - priorityOf(b) || a.form.localeCompare(b.form))
  .slice(0, Number.isFinite(limit) ? limit : undefined);

console.log(`Formes sans audio       : ${pending.length}`);

await mkdir(path.join(AUDIO_DIR, 'any'), { recursive: true });

/** Étape 1 — les médias listés par le Wiktionnaire, 50 pages par requête. */
const wanted = new Map(); // titre de fichier → { form, accent }

for (let offset = 0; offset < pending.length; offset += BATCH) {
  const batch = pending.slice(offset, offset + BATCH);
  try {
    const data = await api(WIKTIONARY, {
      action: 'query',
      prop: 'images',
      imlimit: '100',
      titles: batch.map((record) => record.form).join('|'),
    });

    for (const page of Object.values(data.query?.pages ?? {})) {
      if (page.missing !== undefined) continue;
      const form = String(page.title).toLowerCase();
      for (const image of page.images ?? []) {
        const accent = classify(image.title, form);
        if (accent === null) continue;
        const key = `${form}|${accent}`;
        // Un seul fichier par forme et par accent : le premier listé suffit.
        if (![...wanted.values()].some((item) => `${item.form}|${item.accent}` === key)) {
          wanted.set(image.title, { form, accent, roles: [...(forms.get(form)?.roles ?? [])] });
        }
      }
    }
  } catch (error) {
    console.log(`  lot ${offset / BATCH + 1} échoué : ${String(error)}`);
  }

  console.log(`  ${Math.min(offset + BATCH, pending.length)}/${pending.length} formes · ${wanted.size} médias repérés`);
  await sleep(DELAY_MS);
}

console.log(`\nMédias à résoudre : ${wanted.size}`);

/** Étape 2 — URL réelle, auteur et licence, depuis Commons. */
const titles = [...wanted.keys()];
const resolved = new Map();

for (let offset = 0; offset < titles.length; offset += BATCH) {
  const batch = titles.slice(offset, offset + BATCH);
  try {
    const data = await api(COMMONS, {
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      titles: batch.join('|'),
    });

    const strip = (value) => (value ?? '').replace(/<[^>]+>/g, '').trim();
    for (const page of Object.values(data.query?.pages ?? {})) {
      if (page.missing !== undefined) continue;
      const info = page.imageinfo?.[0];
      if (!info?.url) continue;
      resolved.set(page.title, {
        url: info.url.split('?')[0],
        title: page.title,
        author: strip(info.extmetadata?.Artist?.value) || null,
        license: strip(info.extmetadata?.LicenseShortName?.value) || null,
        licenseUrl: strip(info.extmetadata?.LicenseUrl?.value) || null,
        sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
      });
    }
  } catch (error) {
    console.log(`  résolution ${offset / BATCH + 1} échouée : ${String(error)}`);
  }
  await sleep(DELAY_MS);
}

console.log(`Médias résolus    : ${resolved.size}`);

/** Étape 3 — téléchargement. */
let downloaded = 0;
let failed = 0;

for (const [title, info] of resolved) {
  const target = wanted.get(title);
  if (!target) continue;

  const ext = (info.url.split('.').pop() ?? 'wav').toLowerCase();
  const destination = path.join(AUDIO_DIR, target.accent, `${target.form}.${ext}`);

  if (dryRun) continue;
  if (!(await exists(destination))) {
    try {
      const bytes = await download(info.url, destination);
      downloaded += 1;
      const entry = manifest.forms[target.form] ?? { ipa: null, roles: target.roles };
      entry[target.accent] = { ...info, ext, bytes };
      manifest.forms[target.form] = entry;
    } catch (error) {
      failed += 1;
      if (failed <= 5) console.log(`  échec ${target.form} : ${String(error)}`);
      continue;
    }
    if (downloaded % 25 === 0 && !dryRun) {
      console.log(`  ${downloaded} fichiers téléchargés…`);
      await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    }
    await sleep(800);
  }
}

const entries = Object.values(manifest.forms);
const withAudio = entries.filter((entry) => entry.us || entry.uk || entry.any).length;
const coverage = (value) => `${((value / forms.size) * 100).toFixed(1)} %`;

if (!dryRun) {
  manifest.generatedAt = new Date().toISOString();
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const previous = (await exists(REPORT)) ? await readFile(REPORT, 'utf8') : '';
  await writeFile(
    REPORT,
    `${previous}

## Troisième passe — médias du Wiktionnaire (Lingua Libre)

Les enregistrements Lingua Libre sont nommés par locuteur
(\`LL-Q1860 (eng)-Vealhurl-swum.wav\`) et échappaient donc aux conventions
testées par la deuxième passe. Le Wiktionnaire les référence page par page.

Filtre de langue : seuls les fichiers \`LL-Q1860 (eng)\` sont retenus. La page
« ate » référence aussi un fichier **basque** (\`LL-Q8752 (eus)\`) ; sans ce
filtre l'application ferait prononcer les verbes dans la mauvaise langue.

| Indicateur | Valeur |
|---|---|
| Formes interrogées | ${pending.length} |
| Médias repérés | ${wanted.size} |
| Médias résolus sur Commons | ${resolved.size} |
| Fichiers téléchargés | ${downloaded} |
| Échecs | ${failed} |
| **Couverture après les trois passes** | **${withAudio} / ${forms.size} — ${coverage(withAudio)}** |

Les enregistrements Lingua Libre ne déclarent pas leur accent : ils sont rangés
sous \`any\` et servis en dernier recours, avant la synthèse vocale.
`,
    'utf8',
  );
}

console.log(`\nTéléchargés : ${downloaded} · échecs : ${failed}`);
console.log(`Couverture finale : ${withAudio}/${forms.size} (${coverage(withAudio)})`);
