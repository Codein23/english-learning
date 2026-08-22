import { describe, expect, it } from 'vitest';
import raw from './verbs.json';
import { computePattern, verbSchema, verbsSchema } from './schema';
import { verbs } from './verbs';

describe('dataset verbs.json', () => {
  it('valide le schéma zod dans son intégralité', () => {
    const result = verbsSchema.safeParse(raw);
    if (!result.success) {
      // Message lisible : chemin + cause, pour corriger le dataset sans deviner.
      const issues = result.error.issues
        .slice(0, 10)
        .map((issue) => `${issue.path.join('.')} → ${issue.message}`)
        .join('\n');
      throw new Error(`Dataset invalide :\n${issues}`);
    }
    expect(result.success).toBe(true);
  });

  it('contient les 180 verbes attendus, sans doublon', () => {
    expect(verbs).toHaveLength(180);
    expect(new Set(verbs.map((verb) => verb.id)).size).toBe(180);
  });

  it('déclare un pattern cohérent avec la 1ʳᵉ variante de chaque colonne', () => {
    const mismatches = verbs
      .filter(
        (verb) => computePattern(verb.base, verb.past[0], verb.participle[0]) !== verb.pattern,
      )
      .map((verb) => verb.id);
    expect(mismatches).toEqual([]);
  });

  it('couvre les 100 rangs du top 100 englishpage, une seule fois chacun', () => {
    const ranks = verbs
      .map((verb) => verb.rank)
      .filter((rank): rank is number => rank !== null)
      .sort((a, b) => a - b);
    expect(ranks).toHaveLength(100);
    expect(ranks).toEqual(Array.from({ length: 100 }, (_, index) => index + 1));
  });

  it('rejette une entrée dont une colonne de formes est vide', () => {
    const result = verbSchema.safeParse({
      id: 'eat',
      base: 'eat',
      past: [],
      participle: ['eaten'],
      fr: ['manger'],
      pattern: 'ABC',
      huitoGroup: 'GROUP9',
      rank: 38,
      tier: 1,
      tags: ['huito'],
      note: null,
      ipa: null,
      example: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejette un tier incohérent avec le rang', () => {
    const result = verbsSchema.safeParse([
      {
        id: 'eat',
        base: 'eat',
        past: ['ate'],
        participle: ['eaten'],
        fr: ['manger'],
        pattern: 'ABC',
        huitoGroup: 'GROUP9',
        rank: 38,
        tier: 2,
        tags: ['huito'],
        note: null,
        ipa: null,
        example: null,
      },
    ]);
    expect(result.success).toBe(false);
  });
});

describe('computePattern', () => {
  it.each([
    ['cut', 'cut', 'cut', 'AAA'],
    ['beat', 'beat', 'beaten', 'AAB'],
    ['come', 'came', 'come', 'ABA'],
    ['buy', 'bought', 'bought', 'ABB'],
    ['eat', 'ate', 'eaten', 'ABC'],
  ])('%s / %s / %s → %s', (base, past, participle, expected) => {
    expect(computePattern(base, past, participle)).toBe(expected);
  });
});
