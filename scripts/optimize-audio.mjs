/**
 * Remplace les fichiers OGG et WAV par les transcodages MP3 générés par Wikimedia.
 *
 * Deux problèmes réglés d'un coup :
 *   - **la taille** : un WAV Lingua Libre pèse ~200 ko, son transcodage MP3 ~20 ko.
 *     La banque passe de dizaines de mégaoctets à quelques-uns, ce qui compte pour
 *     une application installée sur téléphone ;
 *   - **la compatibilité** : le MP3 est lu partout, l'OGG non (Safari ancien).
 *     Sans ffmpeg sur la machine de build, ces transcodages sont la seule
 *     conversion disponible.
 *
 * Un fichier sans transcodage disponible est conservé tel quel : le runtime sait
 * déjà retomber sur la synthèse vocale si le navigateur ne lit pas le format.
 *
 * Usage : node scripts/optimize-audio.mjs [--dry-run]
 */
import { readFile, writeFile, unlink, access } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const AUDIO_DIR = path.join(root, 'public', 'audio');
const MANIFEST = path.join(AUDIO_DIR, 'manifest.json');

const dryRun = process.argv.includes('--dry-run');
const UA = 'english-learning-audio-builder/1.0 (https://codein23.github.io/english-learning/)';
const DELAY_MS = 700;

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
 * URL du transcodage MP3 sur Wikimedia.
 * `…/commons/0/0c/Fichier.wav` devient `…/commons/transcoded/0/0c/Fichier.wav/Fichier.wav.mp3`.
 */
function transcodeUrl(originalUrl) {
  const tail = originalUrl.split('/commons/')[1];
  if (!tail) return null;
  const name = originalUrl.split('/').pop();
  return `https://upload.wikimedia.org/wikipedia/commons/transcoded/${tail}/${name}.mp3`;
}

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));

const targets = [];
for (const [form, entry] of Object.entries(manifest.forms)) {
  for (const accent of ['us', 'uk', 'any']) {
    const source = entry[accent];
    if (!source?.url || source.ext === 'mp3') continue;
    targets.push({ form, accent, source });
  }
}

console.log(`Fichiers non-MP3 à convertir : ${targets.length}`);

let converted = 0;
let unavailable = 0;
let bytesBefore = 0;
let bytesAfter = 0;

for (const [index, target] of targets.entries()) {
  const { form, accent, source } = target;
  const url = transcodeUrl(source.url);
  if (!url) {
    unavailable += 1;
    continue;
  }

  const oldPath = path.join(AUDIO_DIR, accent, `${form}.${source.ext}`);
  const newPath = path.join(AUDIO_DIR, accent, `${form}.mp3`);

  try {
    // Wikimedia limite le débit : un 429 n'est pas une absence de transcodage.
    // Sans ce réessai, la première version du script concluait à tort que
    // 676 fichiers sur 711 n'avaient pas de version MP3.
    let response = await fetch(url, { headers: { 'User-Agent': UA } });
    for (let attempt = 1; response.status === 429 && attempt <= 5; attempt += 1) {
      await sleep(4000 * attempt);
      response = await fetch(url, { headers: { 'User-Agent': UA } });
    }

    if (!response.ok) {
      // Pas de transcodage : on garde l'original, il reste lisible par beaucoup
      // de navigateurs et la cascade couvre les autres.
      unavailable += 1;
      if (unavailable <= 5) console.log(`  sans transcodage : ${form} (${response.status})`);
      await sleep(DELAY_MS);
      continue;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 512) {
      unavailable += 1;
      await sleep(DELAY_MS);
      continue;
    }

    if (!dryRun) {
      const previousSize = (await exists(oldPath))
        ? (await readFile(oldPath)).length
        : (source.bytes ?? 0);
      bytesBefore += previousSize;
      bytesAfter += buffer.length;

      await writeFile(newPath, buffer);
      if (await exists(oldPath)) await unlink(oldPath);

      manifest.forms[form][accent] = {
        ...source,
        ext: 'mp3',
        bytes: buffer.length,
        // On garde la trace de l'original : l'attribution porte sur lui.
        originalExt: source.ext,
        transcodedFrom: source.url,
      };
    }
    converted += 1;
  } catch {
    unavailable += 1;
  }

  if ((index + 1) % 50 === 0) {
    console.log(`  ${index + 1}/${targets.length} · ${converted} convertis`);
    if (!dryRun) await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }
  await sleep(DELAY_MS);
}

if (!dryRun) {
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} Mo`;
console.log(`\nConvertis     : ${converted}`);
console.log(`Sans transcodage : ${unavailable} (conservés dans leur format d'origine)`);
if (!dryRun && bytesBefore > 0) {
  console.log(`Taille : ${mb(bytesBefore)} → ${mb(bytesAfter)}`);
}
