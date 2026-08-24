/**
 * Enregistrements de substitution pour les homographes hétérophones (§9.3).
 *
 * Ces clés (`read__past`) ne sont pas des formes du dataset : les passes 2 et 3,
 * qui itèrent sur les formes des verbes, les ignorent. Elles ont pourtant besoin
 * d'un fichier propre, sans quoi le prétérit de `read` se prononcerait [ɹiːd].
 *
 * Chaque substitution est justifiée dans la table ci-dessous : on emprunte
 * l'enregistrement d'un mot **phonétiquement identique**, jamais un à-peu-près.
 *
 * Usage : node scripts/build-audio-overrides.mjs [--dry-run]
 */
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const AUDIO_DIR = path.join(root, 'public', 'audio');
const MANIFEST = path.join(AUDIO_DIR, 'manifest.json');

const dryRun = process.argv.includes('--dry-run');
const UA = 'english-learning-audio-builder/1.0 (https://codein23.github.io/english-learning/)';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';

const OVERRIDES = [
  {
    key: 'read__past',
    word: 'red',
    reason: 'le prétérit de read se prononce [ɹɛd], comme la couleur',
  },
  {
    key: 'read__participle',
    word: 'red',
    reason: 'le participe de read se prononce [ɹɛd], comme la couleur',
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function lookup(titles) {
  const url =
    `${COMMONS}?action=query&prop=imageinfo&iiprop=url%7Cextmetadata&format=json` +
    `&titles=${encodeURIComponent(titles.join('|'))}`;
  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!response.ok) throw new Error(`Commons HTTP ${response.status}`);

  const data = await response.json();
  const strip = (value) => (value ?? '').replace(/<[^>]+>/g, '').trim();

  for (const page of Object.values(data.query?.pages ?? {})) {
    if (page.missing !== undefined) continue;
    const info = page.imageinfo?.[0];
    if (!info?.url) continue;
    return {
      url: info.url.split('?')[0],
      title: page.title,
      author: strip(info.extmetadata?.Artist?.value) || null,
      license: strip(info.extmetadata?.LicenseShortName?.value) || null,
      licenseUrl: strip(info.extmetadata?.LicenseUrl?.value) || null,
      sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
    };
  }
  return null;
}

/** Préfère le transcodage MP3 au fichier d'origine, comme `optimize-audio`. */
async function fetchBest(originalUrl) {
  const tail = originalUrl.split('/commons/')[1];
  const name = originalUrl.split('/').pop();
  const candidates = originalUrl.endsWith('.mp3')
    ? [{ url: originalUrl, ext: 'mp3' }]
    : [
        {
          url: `https://upload.wikimedia.org/wikipedia/commons/transcoded/${tail}/${name}.mp3`,
          ext: 'mp3',
        },
        { url: originalUrl, ext: (name?.split('.').pop() ?? 'ogg').toLowerCase() },
      ];

  for (const candidate of candidates) {
    let response = await fetch(candidate.url, { headers: { 'User-Agent': UA } });
    for (let attempt = 1; response.status === 429 && attempt <= 4; attempt += 1) {
      await sleep(3000 * attempt);
      response = await fetch(candidate.url, { headers: { 'User-Agent': UA } });
    }
    if (!response.ok) continue;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 512) continue;
    return { buffer, ext: candidate.ext };
  }
  return null;
}

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
await mkdir(path.join(AUDIO_DIR, 'us'), { recursive: true });
await mkdir(path.join(AUDIO_DIR, 'any'), { recursive: true });

for (const override of OVERRIDES) {
  const entry = manifest.forms[override.key] ?? { ipa: null, roles: [] };
  if (entry.us || entry.uk || entry.any) {
    console.log(`${override.key} : déjà pourvu`);
    continue;
  }

  const titles = [
    `File:En-us-${override.word}.ogg`,
    `File:En-us-${override.word}.wav`,
    `File:en-us-${override.word}.ogg`,
  ];

  const info = await lookup(titles);
  if (!info) {
    console.log(`${override.key} : aucun enregistrement pour « ${override.word} »`);
    continue;
  }

  const file = await fetchBest(info.url);
  if (!file) {
    console.log(`${override.key} : téléchargement impossible`);
    continue;
  }

  const destination = path.join(AUDIO_DIR, 'us', `${override.key}.${file.ext}`);
  if (!dryRun) {
    if (!(await exists(destination))) await writeFile(destination, file.buffer);
    manifest.forms[override.key] = {
      ...entry,
      us: {
        ...info,
        ext: file.ext,
        bytes: file.buffer.length,
        substitutedWord: override.word,
        reason: override.reason,
      },
    };
  }

  console.log(
    `${override.key} : « ${override.word} » — ${file.ext}, ${file.buffer.length} octets (${override.reason})`,
  );
  await sleep(900);
}

if (!dryRun) {
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log('\nManifeste mis à jour.');
}
