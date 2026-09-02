import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSettings, type Accent, type TtsAccent } from '@/store/settings';
import type { VerbForm } from '@/data/schema';

/**
 * Cascade audio :
 *   1. banque pré-générée avec vraies prononciations `us` / `uk` ;
 *   2. TTS Web Speech configurable en `en-US` ou `en-GB` si aucun enregistrement fiable n'existe ;
 *   3. rien — le bouton haut-parleur est alors masqué, jamais grisé.
 *
 * L'absence d'audio ne doit jamais bloquer un quiz : chaque niveau échoue en
 * silence vers le suivant, y compris en cours de lecture (fichier corrompu,
 * réseau coupé, autoplay refusé).
 */

interface AudioSource {
  /** Extension réelle du fichier : `mp3` quand le CDN répond, `ogg` en repli Commons. */
  ext?: string;
  author?: string | null;
  license?: string | null;
  licenseUrl?: string | null;
  sourceUrl?: string | null;
  title?: string | null;
}

interface ManifestEntry {
  us?: AudioSource;
  uk?: AudioSource;
  /** Enregistrement humain dont l'accent n'est pas déclaré (Lingua Libre). */
  any?: AudioSource;
  ipa?: string | null;
  roles?: string[];
}

interface Manifest {
  forms: Record<string, ManifestEntry>;
}

const BASE = import.meta.env.BASE_URL;

let manifestPromise: Promise<Manifest | null> | null = null;

function loadManifest(): Promise<Manifest | null> {
  manifestPromise ??= fetch(`${BASE}audio/manifest.json`)
    .then((response) => (response.ok ? (response.json() as Promise<Manifest>) : null))
    .catch(() => null);
  return manifestPromise;
}

/** Cache mémoire des objets `Audio` déjà instanciés, pour éviter les recréations. */
const audioCache = new Map<string, HTMLAudioElement>();
let current: HTMLAudioElement | null = null;

function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Choisit explicitement une voix de synthèse native pour l'accent demandé au
 * lieu de laisser le navigateur deviner. Sans cela, de nombreux appareils
 * résolvent `lang: 'en-US'` vers une voix anglophone non native (souvent
 * `en-IN`, accent indien), ce qui casse la qualité perçue.
 *
 * Priorité : (1) locale exacte (`en-US` / `en-GB`), (2) voix dont le nom évoque
 * l'accent canonique, (3) n'importe quelle voix `en-*`.
 */
function pickSynthesisVoice(targetLang: 'en-US' | 'en-GB'): SpeechSynthesisVoice | null {
  if (!ttsAvailable()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const norm = (s: string) => s.toLowerCase().replace(/[_/\s]+/g, '-');
  const target = targetLang.toLowerCase();
  const isUs = target.startsWith('en-us');
  const isUk = target.startsWith('en-gb');

  const exact = voices.filter((v) => norm(v.lang).startsWith(target));
  if (exact.length) {
    // Préférer une voix "Google"/"Natural" quand plusieurs correspondent : plus claire.
    const preferred = exact.find((v) => /google|natural|neural/i.test(v.name));
    return preferred ?? exact[0] ?? null;
  }

  const byName = voices.filter((v) => {
    const n = norm(v.name);
    if (isUs && /united-states|\bus\b|american|david|zira|jenny|guy|aria|samantha|google-us/.test(n)) return true;
    if (isUk && /united-kingdom|\buk\b|\bgb\b|british|daniel|kate|sonia|google-uk|google-gb/.test(n)) return true;
    return false;
  });
  if (byName.length) return byName[0] ?? null;

  const anyEn = voices.filter((v) => norm(v.lang).startsWith('en-'));
  if (anyEn.length) return anyEn[0] ?? null;

  return null;
}

let unlocked = false;

/** Déblocage iOS : sans lecture déclenchée par un geste, Safari reste muet. */
function unlockOnce(): void {
  if (unlocked || typeof window === 'undefined') return;
  unlocked = true;
  try {
    const silent = new Audio();
    silent.muted = true;
    void silent.play().catch(() => undefined);
    if (ttsAvailable()) {
      const utterance = new SpeechSynthesisUtterance('');
      utterance.volume = 0;
      window.speechSynthesis.speak(utterance);
    }
  } catch {
    /* rien : l'audio restera indisponible, ce n'est jamais bloquant */
  }
}

/**
 * Clé d'audio d'une forme. Les homographes hétérophones ont une clé par rôle
 * (`read__past`), les autres formes se contentent de leur orthographe.
 */
export function audioKey(form: string, role?: VerbForm): string {
  return role ? `${form.toLowerCase()}__${role}` : form.toLowerCase();
}

function fileUrl(manifest: Manifest, form: string, role: VerbForm | undefined, accent: Accent) {
  const keys = role ? [audioKey(form, role), form.toLowerCase()] : [form.toLowerCase()];
  const other: Accent = accent === 'us' ? 'uk' : 'us';

  for (const key of keys) {
    const entry = manifest.forms[key];
    if (!entry) continue;

    // Repli fiable seulement : accent demandé, puis l'autre accent déclaré.
    // Les enregistrements `any` (accent inconnu) ne sont plus servis au runtime,
    // car certains sonnent comme une voix non native lisant l'anglais.
    const chosen = entry[accent] ? accent : entry[other] ? other : null;
    if (chosen === null) continue;

    const ext = entry[chosen]?.ext ?? 'mp3';
    return `${BASE}audio/${chosen}/${key}.${ext}`;
  }
  return null;
}

export interface SpeakOptions {
  role?: VerbForm;
}

export interface AudioApi {
  /** `false` quand aucune source n'existe : le bouton doit alors être masqué. */
  available: boolean;
  speak: (text: string, options?: SpeakOptions) => void;
  /** Enchaîne plusieurs formes avec 400 ms de pause. */
  speakSequence: (items: { text: string; role?: VerbForm }[]) => void;
  stop: () => void;
}

export function useAudio(): AudioApi {
  const accent = useSettings((state) => state.accent);
  const ttsAccent = useSettings((state) => state.ttsAccent);
  const volume = useSettings((state) => state.volume);
  const [manifest, setManifest] = useState<Manifest | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadManifest().then((loaded) => {
      if (!cancelled) setManifest(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handler = () => unlockOnce();
    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, []);

  // Pré-charge la liste des voix. Tant que "voiceschanged" n'a pas été émis,
  // getVoices() renvoie une liste vide : sans cela, la première dictée auto
  // n'aurait pas de voix explicite et retomberait sur le défaut du navigateur.
  useEffect(() => {
    if (!ttsAvailable()) return;
    window.speechSynthesis.getVoices(); // déclenche le chargement asynchrone
    const onVoices = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener('voiceschanged', onVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
  }, []);

  const stop = useCallback(() => {
    if (current) {
      current.pause();
      current.currentTime = 0;
      current = null;
    }
    if (ttsAvailable()) window.speechSynthesis.cancel();
  }, []);

  const speakWithTts = useCallback(
    (text: string) => {
      if (!ttsAvailable() || text.trim() === '') return;
      const utterance = new SpeechSynthesisUtterance(text);
      const langByAccent: Record<TtsAccent, 'en-US' | 'en-GB'> = {
        us: 'en-US',
        uk: 'en-GB',
      };
      const lang = langByAccent[ttsAccent];
      utterance.lang = lang;
      // Voix native explicite — voir pickSynthesisVoice. Empêche le navigateur
      // de retomber sur un accent non natif (ex. en-IN).
      const voice = pickSynthesisVoice(lang);
      if (voice) utterance.voice = voice;
      utterance.rate = 0.9;
      utterance.volume = volume;
      window.speechSynthesis.speak(utterance);
    },
    [ttsAccent, volume],
  );

  const speak = useCallback(
    (text: string, options: SpeakOptions = {}) => {
      if (text.trim() === '') return;
      // Un nouveau clic coupe la lecture en cours : jamais de superposition.
      stop();

      const url = manifest ? fileUrl(manifest, text, options.role, accent) : null;
      if (url === null) {
        speakWithTts(text);
        return;
      }

      const audio = audioCache.get(url) ?? new Audio(url);
      audioCache.set(url, audio);
      audio.volume = volume;
      audio.currentTime = 0;
      current = audio;

      // Fichier illisible ou lecture refusée : on retombe sur la synthèse
      // plutôt que de laisser l'utilisateur devant un bouton muet.
      void audio.play().catch(() => speakWithTts(text));
    },
    [accent, manifest, speakWithTts, stop, volume],
  );

  const speakSequence = useCallback(
    (items: { text: string; role?: VerbForm }[]) => {
      stop();
      const queue = items.filter((item) => item.text.trim() !== '');
      let index = 0;

      const next = () => {
        const item = queue[index];
        index += 1;
        if (!item) return;
        speak(item.text, item.role ? { role: item.role } : {});
        // 400 ms entre deux formes : assez pour les distinguer, pas assez pour
        // que l'enchaînement paraisse haché.
        window.setTimeout(next, 900);
      };
      next();
    },
    [speak, stop],
  );

  // Niveau 3 : ni banque, ni synthèse — le bouton disparaît.
  const available = manifest !== null || ttsAvailable();

  return useMemo(
    () => ({ available, speak, speakSequence, stop }),
    [available, speak, speakSequence, stop],
  );
}

/** Transcription phonétique d'une forme, si la banque en connaît une. */
export function useIpa(form: string, role?: VerbForm): string | null {
  const [manifest, setManifest] = useState<Manifest | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadManifest().then((loaded) => {
      if (!cancelled) setManifest(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!manifest) return null;
  const keys = role ? [audioKey(form, role), form.toLowerCase()] : [form.toLowerCase()];
  for (const key of keys) {
    const ipa = manifest.forms[key]?.ipa;
    if (ipa) return ipa;
  }
  return null;
}
