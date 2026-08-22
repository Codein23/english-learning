import raw from './verbs.json';
import { verbsSchema, type HuitoGroup, type Pattern, type Verb } from './schema';

/**
 * Le dataset est validé une seule fois, au chargement du module.
 * En développement et en test, une entrée invalide lève immédiatement ;
 * en production le parse est identique (le dataset est figé et testé au build).
 */
export const verbs: Verb[] = verbsSchema.parse(raw);

export const verbsById: ReadonlyMap<string, Verb> = new Map(
  verbs.map((verb) => [verb.id, verb]),
);

export function getVerb(id: string): Verb | undefined {
  return verbsById.get(id);
}

/** Toutes les formes distinctes d'un verbe, dans l'ordre base → prétérit → participe. */
export function allForms(verb: Verb): string[] {
  return [verb.base, ...verb.past, ...verb.participle];
}

/** Nombre de verbes par groupe Huito, pour les compteurs de filtres. */
export const countByGroup: ReadonlyMap<HuitoGroup | 'null', number> = verbs.reduce(
  (acc, verb) => {
    const key = verb.huitoGroup ?? 'null';
    acc.set(key, (acc.get(key) ?? 0) + 1);
    return acc;
  },
  new Map<HuitoGroup | 'null', number>(),
);

export const countByPattern: ReadonlyMap<Pattern, number> = verbs.reduce((acc, verb) => {
  acc.set(verb.pattern, (acc.get(verb.pattern) ?? 0) + 1);
  return acc;
}, new Map<Pattern, number>());

export const countByTier: ReadonlyMap<1 | 2 | 3, number> = verbs.reduce((acc, verb) => {
  acc.set(verb.tier, (acc.get(verb.tier) ?? 0) + 1);
  return acc;
}, new Map<1 | 2 | 3, number>());

/** Toutes les étiquettes présentes dans le dataset (`huito`, `top100`, …). */
export const allTags: string[] = [...new Set(verbs.flatMap((verb) => verb.tags))].sort();
