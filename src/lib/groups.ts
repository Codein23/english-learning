import type { HuitoGroup, Pattern } from '@/data/schema';

/**
 * Les groupes Huito sont un héritage du document source. On conserve leur
 * sémantique, pas leurs aplats saturés : chaque groupe reçoit une teinte,
 * la clarté et le chroma sont fixés par le thème (cf. `.group-chip`).
 * Le libellé est toujours écrit dans la chip — la couleur n'est jamais
 * seule porteuse d'information.
 */

export interface GroupMeta {
  /** Teinte OKLCH, en degrés. */
  hue: number;
  label: string;
  description: string;
}

export const GROUP_META: Record<HuitoGroup, GroupMeta> = {
  RED: { hue: 25, label: 'Red', description: 'Groupe « red » du tableau Huito' },
  LD: { hue: 55, label: 'LD', description: 'Base en -d → prétérit et participe en -t' },
  GEMINI: { hue: 95, label: 'Gemini', description: 'Prétérit et participe identiques' },
  TRIPLETS: { hue: 145, label: 'Triplets', description: 'Trois formes identiques' },
  TEA: { hue: 185, label: 'Tea', description: 'Voyelle longue → -t' },
  GROUP6: { hue: 225, label: 'Groupe 6', description: 'Groupe 6 du tableau Huito' },
  GHT: { hue: 265, label: 'GHT', description: 'Prétérit et participe en -ght' },
  GROUP8: { hue: 300, label: 'Groupe 8', description: 'Groupe 8 du tableau Huito' },
  GROUP9: { hue: 343, label: 'Groupe 9', description: 'Trois formes différentes' },
  OUTSIDERS: { hue: 0, label: 'Outsiders', description: 'Irréguliers hors classification' },
};

/** `OUTSIDERS` est rendu en neutre (chroma 0) : il ne désigne pas une famille. */
export function isNeutralGroup(group: HuitoGroup): boolean {
  return group === 'OUTSIDERS';
}

export const PATTERN_EXAMPLE: Record<Pattern, string> = {
  AAA: 'cut · cut · cut',
  AAB: 'beat · beat · beaten',
  ABA: 'come · came · come',
  ABB: 'buy · bought · bought',
  ABC: 'eat · ate · eaten',
};

export const TIER_LABEL: Record<1 | 2 | 3, string> = {
  1: 'Tier 1 · rangs 1-50',
  2: 'Tier 2 · rangs 51-100',
  3: 'Tier 3 · hors top 100',
};
