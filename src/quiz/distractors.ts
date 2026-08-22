import type { Verb, VerbForm } from '@/data/schema';
import type { Rng } from './rng';

/**
 * Distracteurs intelligents (§6.2) : jamais aléatoires.
 * Trois familles, par ordre de priorité :
 *   1. surgénéralisation régulière (*writed*, *goed*) — l'erreur réelle d'un apprenant ;
 *   2. formes de verbes du même `pattern` — plausibles morphologiquement ;
 *   3. formes de verbes phonétiquement voisins (même début ou même rime).
 */

/** Applique les règles orthographiques du prétérit régulier : *stop* → *stopped*. */
export function regularize(base: string): string {
  const word = base.toLowerCase();
  if (word.endsWith('e')) return `${word}d`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ied`;
  // Redoublement de la consonne finale sur les monosyllabes CVC (*put* → *putted*).
  if (/^[^aeiou]*[aeiou][^aeiouwxy]$/.test(word)) return `${word}${word.slice(-1)}ed`;
  return `${word}ed`;
}

function rime(word: string): string {
  return word.slice(-3);
}

function formsOf(verb: Verb, form: VerbForm): string[] {
  if (form === 'base') return [verb.base];
  return form === 'past' ? verb.past : verb.participle;
}

export interface DistractorOptions {
  verb: Verb;
  form: VerbForm;
  /** Réponses correctes, à exclure du tirage. */
  accepted: string[];
  pool: Verb[];
  count: number;
  rng: Rng;
}

export function buildDistractors({
  verb,
  form,
  accepted,
  pool,
  count,
  rng,
}: DistractorOptions): string[] {
  const banned = new Set(accepted.map((value) => value.toLowerCase()));
  const chosen: string[] = [];

  const push = (candidate: string | undefined): void => {
    if (!candidate) return;
    const value = candidate.toLowerCase();
    if (banned.has(value) || value === verb.base.toLowerCase()) return;
    banned.add(value);
    chosen.push(candidate);
  };

  // 1. Surgénéralisation : l'erreur que l'apprenant commettrait vraiment.
  push(regularize(verb.base));

  // 2. Même pattern : morphologiquement plausible.
  const samePattern = rng.shuffle(
    pool.filter((other) => other.id !== verb.id && other.pattern === verb.pattern),
  );
  for (const other of samePattern) {
    if (chosen.length >= count) break;
    push(formsOf(other, form)[0]);
  }

  // 3. Voisins phonétiques : même attaque ou même rime.
  if (chosen.length < count) {
    const neighbours = rng.shuffle(
      pool.filter(
        (other) =>
          other.id !== verb.id &&
          (other.base.slice(0, 2) === verb.base.slice(0, 2) ||
            rime(other.base) === rime(verb.base)),
      ),
    );
    for (const other of neighbours) {
      if (chosen.length >= count) break;
      push(formsOf(other, form)[0]);
    }
  }

  // 4. Filet de sécurité : n'importe quelle autre forme du périmètre.
  if (chosen.length < count) {
    for (const other of rng.shuffle(pool)) {
      if (chosen.length >= count) break;
      if (other.id === verb.id) continue;
      push(formsOf(other, form)[0]);
    }
  }

  return chosen.slice(0, count);
}
