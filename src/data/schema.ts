import { z } from 'zod';

/**
 * Schéma du dataset `verbs.json` (180 verbes).
 * Le dataset est figé : ce schéma est un garde-fou, pas une couche de transformation.
 * Toute entrée invalide fait échouer le test `schema.test.ts` — et le build.
 */

export const PATTERNS = ['AAA', 'AAB', 'ABA', 'ABB', 'ABC'] as const;

export const HUITO_GROUPS = [
  'RED',
  'LD',
  'GEMINI',
  'TRIPLETS',
  'TEA',
  'GROUP6',
  'GHT',
  'GROUP8',
  'GROUP9',
  'OUTSIDERS',
] as const;

export const VERB_FORMS = ['base', 'past', 'participle'] as const;

export type Pattern = (typeof PATTERNS)[number];
export type HuitoGroup = (typeof HUITO_GROUPS)[number];
export type VerbForm = (typeof VERB_FORMS)[number];

const nonEmptyString = z.string().trim().min(1);

/** Clé d'audio `<forme>__<rôle>` — cf. §9.3 (homographes hétérophones). */
const audioKeySchema = z.string().regex(/^[a-z-]+__(base|past|participle)$/);

export const verbSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z][a-z-]*$/, 'id doit être en minuscules, sans espace'),
  base: nonEmptyString,
  past: z.array(nonEmptyString).min(1),
  participle: z.array(nonEmptyString).min(1),
  fr: z.array(nonEmptyString).min(1),
  pattern: z.enum(PATTERNS),
  huitoGroup: z.enum(HUITO_GROUPS).nullable(),
  rank: z.number().int().min(1).max(100).nullable(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  tags: z.array(nonEmptyString),
  /** Piège pédagogique, affiché en correction dès que le verbe est raté. */
  note: nonEmptyString.nullable(),
  /** Rempli par `scripts/build-audio.mjs` (§9.2). Jamais bloquant. */
  ipa: nonEmptyString.nullable(),
  /** Phrase courte au prétérit ou au participe. Jamais bloquant. */
  example: nonEmptyString.nullable(),
  /** Surcharge de clé audio quand la forme seule ne suffit pas (`read`, `wind`…). */
  audioKeys: z
    .object({
      base: audioKeySchema.optional(),
      past: audioKeySchema.optional(),
      participle: audioKeySchema.optional(),
    })
    .optional(),
});

export type Verb = z.infer<typeof verbSchema>;

export const verbsSchema = z
  .array(verbSchema)
  .min(1)
  .superRefine((verbs, ctx) => {
    const seen = new Set<string>();
    for (const [index, verb] of verbs.entries()) {
      if (seen.has(verb.id)) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'id'],
          message: `id dupliqué : ${verb.id}`,
        });
      }
      seen.add(verb.id);

      // `tier` et `rank` doivent rester cohérents : c'est le filtre de difficulté.
      const expectedTier = verb.rank === null ? 3 : verb.rank <= 50 ? 1 : 2;
      if (verb.tier !== expectedTier) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'tier'],
          message: `tier ${verb.tier} incohérent avec rank ${String(verb.rank)} (attendu ${expectedTier})`,
        });
      }
    }
  });

/**
 * Recalcule le `pattern` à partir de la 1ʳᵉ variante de chaque colonne.
 * Utilisé par le test de cohérence du dataset et par le mode « Tri par pattern ».
 */
export function computePattern(
  base: string,
  past: string | undefined,
  participle: string | undefined,
): Pattern {
  const b = base.toLowerCase();
  const p = (past ?? '').toLowerCase();
  const pp = (participle ?? '').toLowerCase();

  if (b === p && p === pp) return 'AAA';
  if (b === p && p !== pp) return 'AAB';
  if (b !== p && b === pp) return 'ABA';
  if (b !== p && p === pp) return 'ABB';
  return 'ABC';
}
