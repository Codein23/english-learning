/**
 * Construction de la banque audio (§9.2), hors runtime.
 *
 * Source : Free Dictionary API (`api.dictionaryapi.dev`), qui sert des
 * enregistrements humains issus du Wiktionnaire **au format MP3** et expose,
 * pour chacun, son URL d'origine et sa licence. On préfère cette source aux
 * fichiers OGG de Wikimedia Commons parce qu'aucun convertisseur n'est requis :
 * ffmpeg n'est pas disponible sur la machine de build, et Safari lit mal l'OGG.
 *
 * Le script :
 *  - travaille sur les **formes uniques**, jamais sur les verbes (`cut` n'est
 *    téléchargé qu'une fois et sert aux trois colonnes) ;
 *  - est **idempotent et incrémental** : un fichier déjà présent n'est pas
 *    retéléchargé, sauf `--force` ;
 *  - remplit le champ `ipa` du dataset au passage ;
 *  - journalise tout dans `scripts/audio-report.md`, échecs compris.
 *
 * Usage : node scripts/build-audio.mjs [--force] [--limit N] [--dry-run]
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const DATASET = path.join(root, 'src', 'data', 'verbs.json');
const AUDIO_DIR = path.join(root, 'public', 'audio');
const MANIFEST = path.join(AUDIO_DIR, 'manifest.json');
const REPORT = path.join(root, 'scripts', 'audio-report.md');

const args = process.argv.slice(2);
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex === -1 ? Infinity : Number(args[limitIndex + 1] ?? Infinity);

/**
 * L'API applique une limite de débit stricte : au-delà d'environ une requête par
 * seconde elle renvoie 429 en rafale. Une seule requête en vol, cadencée, obtient
 * 100 % de réponses là où quatre en parallèle n'obtenaient que des refus.
 */
const CONCURRENCY = 1;
const REQUEST_DELAY_MS = 1200;
const API = 'https://api.dictionaryapi.dev/api/v2/entries/en';

/**
 * Homographes hétérophones (§9.3).
 *
 * `read` au prétérit et au participe se prononce [red] : l'enregistrement du mot
 * « red » est phonétiquement identique et sert donc de source, ce qui est
 * documenté ici plutôt que caché dans le code.
 *
 * Les autres cas ne peuvent pas être résolus automatiquement — le dictionnaire
 * renvoie la prononciation du nom, pas celle du verbe. Ils sont listés dans le
 * rapport pour vérification à l'oreille, et restent sur la synthèse vocale.
 */
const AUDIO_OVERRIDES = {
  read__past: { form: 'read', lookup: 'red', reason: 'prétérit de read se prononce [red]' },
  read__participle: {
    form: 'read',
    lookup: 'red',
    reason: 'participe de read se prononce [red]',
  },
};

const MANUAL_REVIEW = [
  ['wind', 'Le verbe se prononce [waɪnd], le nom [wɪnd] : le dictionnaire renvoie le nom.'],
  ['tear', 'Le verbe se prononce [teə], le nom (larme) [tɪə].'],
  ['lead', 'Le verbe se prononce [liːd], le métal [led]. Le prétérit « led » est correct.'],
  ['live', 'Le verbe [lɪv] et l’adjectif [laɪv] partagent la même graphie.'],
  ['bow', 'Deux prononciations selon le sens.'],
  ['sow', 'Le verbe [səʊ] et la truie [saʊ] partagent la même graphie.'],
  ['wound', 'Prétérit de wind [waʊnd] ≠ blessure [wuːnd].'],
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

/** Détecte l'accent d'un enregistrement à partir du suffixe de son nom de fichier. */
function accentOf(url) {
  const name = url.split('/').pop() ?? '';
  if (/-us\.mp3$/i.test(name)) return 'us';
  if (/-uk\.mp3$/i.test(name) || /-gb\.mp3$/i.test(name)) return 'uk';
  return null;
}

async function fetchEntry(word, attempt = 1) {
  try {
    const response = await fetch(`${API}/${encodeURIComponent(word)}`, {
      headers: { 'User-Agent': 'english-learning/1.0 (build script)' },
    });

    if (response.status === 404) return { status: 'not_found' };
    if (response.status === 429) {
      // Limitation de débit : on ralentit franchement plutôt que d'insister.
      if (attempt > 6) return { status: 'rate_limited' };
      await sleep(5000 * attempt);
      return fetchEntry(word, attempt + 1);
    }
    if (!response.ok) return { status: 'http_error', code: response.status };

    return { status: 'ok', data: await response.json() };
  } catch (error) {
    if (attempt <= 3) {
      await sleep(500 * attempt);
      return fetchEntry(word, attempt + 1);
    }
    return { status: 'network_error', message: String(error) };
  }
}

/** Extrait les enregistrements par accent et la transcription phonétique. */
function extract(data) {
  const audio = {};
  let ipa = null;

  for (const entry of Array.isArray(data) ? data : []) {
    for (const phonetic of entry.phonetics ?? []) {
      if (typeof phonetic.text === 'string' && phonetic.text.trim() !== '' && ipa === null) {
        ipa = phonetic.text.trim();
      }
      if (typeof phonetic.audio !== 'string' || phonetic.audio === '') continue;

      const accent = accentOf(phonetic.audio);
      if (accent === null || audio[accent]) continue;

      audio[accent] = {
        url: phonetic.audio,
        sourceUrl: phonetic.sourceUrl ?? null,
        license: phonetic.license?.name ?? null,
        licenseUrl: phonetic.license?.url ?? null,
      };
    }
    if (typeof entry.phonetic === 'string' && entry.phonetic.trim() !== '' && ipa === null) {
      ipa = entry.phonetic.trim();
    }
  }

  return { audio, ipa };
}

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

/**
 * Résout le fichier d'origine sur Wikimedia Commons à partir du `sourceUrl`
 * fourni par l'API (`…?curid=195869`). Sert de repli quand le CDN média de
 * l'API est indisponible — ce qui arrive — et fournit surtout l'auteur réel de
 * l'enregistrement, indispensable pour les licences CC-BY et CC-BY-SA.
 */
async function resolveCommons(sourceUrl) {
  const curid = /curid=(\d+)/.exec(sourceUrl ?? '')?.[1];
  if (!curid) return null;

  try {
    const response = await fetch(
      `${COMMONS_API}?action=query&prop=imageinfo&iiprop=url%7Cextmetadata&format=json&pageids=${curid}`,
      { headers: { 'User-Agent': 'english-learning/1.0 (build script)' } },
    );
    if (!response.ok) return null;

    const data = await response.json();
    const page = Object.values(data.query?.pages ?? {})[0];
    const info = page?.imageinfo?.[0];
    if (!info?.url) return null;

    const strip = (value) => (value ?? '').replace(/<[^>]+>/g, '').trim();
    return {
      url: info.url.split('?')[0],
      title: page.title ?? null,
      author: strip(info.extmetadata?.Artist?.value) || null,
      license: strip(info.extmetadata?.LicenseShortName?.value) || null,
      licenseUrl: strip(info.extmetadata?.LicenseUrl?.value) || null,
    };
  } catch {
    return null;
  }
}

async function download(url, destination, attempt = 1) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'english-learning/1.0 (build script)' },
  });
  // Le CDN média renvoie parfois 502 ou 429 : on réessaie avant d'abandonner.
  if ((response.status === 502 || response.status === 429) && attempt <= 3) {
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

/** Formes uniques → rôles où elles apparaissent. Base incluse. */
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

// Clés supplémentaires pour les homographes : `read__past` est traité comme une
// entrée à part entière, avec son propre fichier.
for (const [key, override] of Object.entries(AUDIO_OVERRIDES)) {
  if (!forms.has(override.form)) continue;
  forms.set(key, {
    form: override.form,
    key,
    lookup: override.lookup,
    roles: new Set([key.split('__')[1]]),
    verbs: new Set(forms.get(override.form)?.verbs ?? []),
  });
}

/**
 * Priorité de traitement : les formes des verbes fréquents d'abord.
 * Une exécution interrompue laisse ainsi une banque utile plutôt qu'un
 * échantillon aléatoire — `went` compte plus que `outsprang`.
 */
const tierOf = new Map(verbs.map((verb) => [verb.id, verb.tier]));
const priorityOf = (record) =>
  Math.min(...[...record.verbs].map((verbId) => tierOf.get(verbId) ?? 3));

const uniqueForms = [...forms.values()].sort((a, b) => {
  const difference = priorityOf(a) - priorityOf(b);
  return difference !== 0 ? difference : a.form.localeCompare(b.form);
});
const occurrences = verbs.reduce(
  (sum, verb) => sum + 1 + verb.past.length + verb.participle.length,
  0,
);

console.log(`Occurrences de formes : ${occurrences}`);
console.log(`Formes uniques        : ${uniqueForms.length}`);
console.log(`Déduplication         : ${occurrences - uniqueForms.length} téléchargements évités`);

const previous = (await exists(MANIFEST))
  ? JSON.parse(await readFile(MANIFEST, 'utf8'))
  : { forms: {} };

await mkdir(path.join(AUDIO_DIR, 'us'), { recursive: true });
await mkdir(path.join(AUDIO_DIR, 'uk'), { recursive: true });

const manifest = { generatedAt: null, source: 'api.dictionaryapi.dev', forms: {} };
const failures = [];
const ipaByForm = new Map();
let downloaded = 0;
let reused = 0;
let processed = 0;

const queue = uniqueForms.slice(0, Number.isFinite(limit) ? limit : undefined);

/**
 * Traite une clé d'audio. La clé est normalement la forme elle-même, mais vaut
 * `<forme>__<rôle>` pour les homographes hétérophones : `read` en base se
 * prononce [riːd] et doit garder son propre enregistrement, tandis que
 * `read__past` emprunte celui de « red ». Appliquer la substitution à la forme
 * entière aurait cassé la prononciation de la base.
 */
async function handle(record) {
  const form = record.key ?? record.form;
  const lookup = record.lookup ?? form;

  const existingEntry = previous.forms?.[form];
  const declaredAccents = existingEntry
    ? ['us', 'uk'].filter((accent) => existingEntry[accent])
    : [];
  // Une entrée sans aucun accent n'est pas « complète » : c'est une tentative
  // qui a échoué, et il faut la rejouer. `every` sur un tableau vide vaut `true`,
  // d'où la vérification explicite de la longueur.
  const filesPresent =
    declaredAccents.length > 0 &&
    (
      await Promise.all(
        declaredAccents.map((accent) =>
          exists(
            path.join(AUDIO_DIR, accent, `${form}.${existingEntry[accent].ext ?? 'mp3'}`),
          ),
        ),
      )
    ).every(Boolean);

  // Incrémental : rien à refaire si le manifeste et les fichiers concordent.
  if (!force && existingEntry && filesPresent) {
    manifest.forms[form] = existingEntry;
    if (existingEntry.ipa) ipaByForm.set(form, existingEntry.ipa);
    reused += 1;
    return;
  }

  const result = await fetchEntry(lookup);
  if (result.status !== 'ok') {
    failures.push({ form, reason: result.status, detail: result.code ?? result.message ?? '' });
    return;
  }

  const { audio, ipa } = extract(result.data);
  if (ipa) ipaByForm.set(form, ipa);

  const entry = { ipa: ipa ?? null, roles: [...record.roles] };

  for (const accent of ['us', 'uk']) {
    const source = audio[accent];
    if (!source) continue;
    if (dryRun) {
      entry[accent] = { ...source, ext: 'mp3', bytes: null };
      continue;
    }

    // 1. MP3 servi par l'API — format idéal, mais CDN parfois indisponible.
    const mp3Path = path.join(AUDIO_DIR, accent, `${form}.mp3`);
    if (!force && (await exists(mp3Path))) {
      entry[accent] = { ...source, ext: 'mp3', bytes: null };
      continue;
    }

    try {
      const bytes = await download(source.url, mp3Path);
      entry[accent] = { ...source, ext: 'mp3', bytes };
      downloaded += 1;
      continue;
    } catch {
      /* on tente la source d'origine sur Commons */
    }

    // 2. Fichier d'origine sur Wikimedia Commons, quel que soit son format.
    //    Les navigateurs qui ne lisent pas l'OGG retomberont sur la synthèse
    //    vocale au moment de la lecture : la cascade reste intacte.
    const commons = await resolveCommons(source.sourceUrl);
    if (!commons) {
      failures.push({ form, reason: `download_${accent}`, detail: 'CDN et Commons indisponibles' });
      continue;
    }

    const ext = (commons.url.split('.').pop() ?? 'ogg').toLowerCase();
    const destination = path.join(AUDIO_DIR, accent, `${form}.${ext}`);
    if (!force && (await exists(destination))) {
      entry[accent] = { ...source, ...commons, ext, bytes: null };
      continue;
    }

    try {
      const bytes = await download(commons.url, destination);
      entry[accent] = { ...source, ...commons, ext, bytes };
      downloaded += 1;
    } catch (error) {
      failures.push({ form, reason: `download_${accent}`, detail: String(error) });
    }
  }

  if (entry.us || entry.uk || entry.ipa) manifest.forms[form] = entry;
  if (!entry.us && !entry.uk) {
    failures.push({ form, reason: 'no_audio', detail: 'aucun enregistrement us/uk' });
  }
}

// Pool de concurrence simple : quatre requêtes en vol, pas davantage.
const workers = Array.from({ length: CONCURRENCY }, async () => {
  for (;;) {
    const record = queue[processed];
    if (!record) return;
    processed += 1;
    const index = processed;
    await handle(record);
    if (index % 25 === 0) {
      console.log(
        `  ${index}/${queue.length} formes · ${downloaded} fichiers · ${failures.length} échecs`,
      );
      // Sauvegarde intermédiaire : une interruption ne fait pas tout perdre.
      if (!dryRun) {
        await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
      }
    }
    await sleep(REQUEST_DELAY_MS);
  }
});

await Promise.all(workers);

manifest.generatedAt = new Date().toISOString();

const withUs = Object.values(manifest.forms).filter((entry) => entry.us).length;
const withUk = Object.values(manifest.forms).filter((entry) => entry.uk).length;
const withAny = Object.values(manifest.forms).filter((entry) => entry.us || entry.uk).length;
const withIpa = Object.values(manifest.forms).filter((entry) => entry.ipa).length;
const coverage = (value) => `${((value / uniqueForms.length) * 100).toFixed(1)} %`;

// Le champ `ipa` du dataset porte la prononciation de la **base**.
//
// Le dataset est **relu ici**, et non réutilisé depuis le chargement initial :
// l'exécution dure plusieurs heures, et un autre script (phrases d'exemple) a
// pu écrire entre-temps. Écrire une copie vieille de deux heures effacerait
// silencieusement ce travail.
const currentVerbs = JSON.parse(await readFile(DATASET, 'utf8'));
const updatedVerbs = currentVerbs.map((verb) => {
  const ipa = ipaByForm.get(verb.base.toLowerCase()) ?? verb.ipa;
  return { ...verb, ipa: ipa ?? null };
});
const verbsWithIpa = updatedVerbs.filter((verb) => verb.ipa).length;

const report = `# Rapport de construction de la banque audio

Généré par \`scripts/build-audio.mjs\` le ${new Date().toLocaleString('fr-FR')}.
Ne pas éditer à la main.

## Couverture

| Indicateur | Valeur |
|---|---|
| Occurrences de formes dans le dataset | ${occurrences} |
| Formes uniques (ce qui est réellement téléchargé) | ${uniqueForms.length} |
| Formes avec au moins un enregistrement | ${withAny} — ${coverage(withAny)} |
| Formes avec accent américain | ${withUs} — ${coverage(withUs)} |
| Formes avec accent britannique | ${withUk} — ${coverage(withUk)} |
| Formes avec transcription phonétique | ${withIpa} — ${coverage(withIpa)} |
| Verbes dont le champ \`ipa\` est renseigné | ${verbsWithIpa} / ${verbs.length} |
| Fichiers téléchargés lors de cette exécution | ${downloaded} |
| Formes réutilisées sans retéléchargement | ${reused} |

## Homographes hétérophones — vérification à l'oreille obligatoire

Ces formes ne peuvent pas être résolues automatiquement : le dictionnaire renvoie
la prononciation du nom ou d'un autre sens. Elles restent sur la synthèse vocale
tant qu'un enregistrement correct n'a pas été choisi manuellement.

${MANUAL_REVIEW.map(([form, note]) => `- **${form}** — ${note}`).join('\n')}

Substitutions volontaires déjà appliquées :

${Object.entries(AUDIO_OVERRIDES)
  .map(([key, value]) => `- \`${key}\` → enregistrement de « ${value.lookup} » (${value.reason})`)
  .join('\n')}

## Échecs

${
  failures.length === 0
    ? '_Aucun._'
    : `${failures.length} formes sans enregistrement exploitable.\n\n| Forme | Cause |\n|---|---|\n${failures
        .slice(0, 200)
        .map((failure) => `| \`${failure.form}\` | ${failure.reason} |`)
        .join('\n')}`
}
`;

if (dryRun) {
  console.log('\nSimulation : aucun fichier écrit.');
} else {
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await writeFile(REPORT, report, 'utf8');
  const json = `${JSON.stringify(updatedVerbs, null, 2)}\n`;
  await writeFile(DATASET, json, 'utf8');
  await writeFile(path.join(root, 'verbs.json'), json, 'utf8');
}

console.log(`\nFormes avec audio : ${withAny}/${uniqueForms.length} (${coverage(withAny)})`);
console.log(`Formes avec IPA   : ${withIpa}/${uniqueForms.length} (${coverage(withIpa)})`);
console.log(`Verbes avec IPA   : ${verbsWithIpa}/${verbs.length}`);
console.log(`Téléchargés : ${downloaded} · réutilisés : ${reused} · échecs : ${failures.length}`);
