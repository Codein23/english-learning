import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSettings } from '@/store/settings';

/**
 * Cascade audio du §9, niveaux 2 et 3.
 * Le niveau 1 (banque MP3 pré-générée + manifest) sera branché ici sans changer
 * l'interface publique du hook : `speak()` tentera d'abord le fichier, puis la
 * synthèse vocale, puis renoncera silencieusement.
 */

let unlocked = false;

/** Déblocage iOS : la première interaction utilisateur autorise la lecture. */
function unlockOnce(): void {
  if (unlocked || typeof window === 'undefined') return;
  unlocked = true;
  try {
    const utterance = new SpeechSynthesisUtterance('');
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);
  } catch {
    /* la synthèse restera indisponible, ce n'est jamais bloquant */
  }
}

function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export interface AudioApi {
  /** `false` quand aucune source n'existe : le bouton doit alors être masqué. */
  available: boolean;
  speak: (text: string) => void;
  /** Enchaîne les trois formes avec une pause de 400 ms. */
  speakSequence: (texts: string[]) => void;
  stop: () => void;
}

export function useAudio(): AudioApi {
  const accent = useSettings((state) => state.accent);
  const volume = useSettings((state) => state.volume);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!ttsAvailable()) return;
    const check = () => setAvailable(window.speechSynthesis.getVoices().length > 0 || true);
    check();
    window.speechSynthesis.addEventListener('voiceschanged', check);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', check);
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

  const stop = useCallback(() => {
    if (!ttsAvailable()) return;
    window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!ttsAvailable() || text.trim() === '') return;
      // Un nouveau clic coupe la lecture en cours : jamais de superposition.
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = accent === 'uk' ? 'en-GB' : 'en-US';
      utterance.rate = 0.9;
      utterance.volume = volume;
      window.speechSynthesis.speak(utterance);
    },
    [accent, volume],
  );

  const speakSequence = useCallback(
    (texts: string[]) => {
      if (!ttsAvailable()) return;
      window.speechSynthesis.cancel();
      texts
        .filter((text) => text.trim() !== '')
        .forEach((text, position) => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = accent === 'uk' ? 'en-GB' : 'en-US';
          utterance.rate = 0.9;
          utterance.volume = volume;
          // La pause de 400 ms est obtenue en enchaînant les énoncés :
          // l'API sérialise déjà la file, on ajoute un court silence.
          if (position > 0) {
            const gap = new SpeechSynthesisUtterance(' ');
            gap.volume = 0;
            gap.rate = 0.1;
            window.speechSynthesis.speak(gap);
          }
          window.speechSynthesis.speak(utterance);
        });
    },
    [accent, volume],
  );

  return useMemo(
    () => ({ available: available && ttsAvailable(), speak, speakSequence, stop }),
    [available, speak, speakSequence, stop],
  );
}
