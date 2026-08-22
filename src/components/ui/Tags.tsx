import { Check, Star } from 'lucide-react';
import type { HuitoGroup, Pattern } from '@/data/schema';
import { GROUP_META, isNeutralGroup } from '@/lib/groups';
import { cx } from '@/lib/cx';

/**
 * Chip de groupe Huito. La teinte porte la famille, le libellé porte le sens :
 * l'information reste lisible en niveaux de gris et pour un daltonien.
 */
export function GroupChip({ group, className }: { group: HuitoGroup; className?: string }) {
  const meta = GROUP_META[group];
  const neutral = isNeutralGroup(group);

  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium whitespace-nowrap',
        neutral ? 'group-chip-neutral' : 'group-chip',
        className,
      )}
      style={neutral ? undefined : ({ '--h': meta.hue } as React.CSSProperties)}
      title={meta.description}
    >
      {meta.label}
    </span>
  );
}

/**
 * Étiquette de pattern : monospacée, sans couleur.
 * Deux systèmes chromatiques concurrents sur une même ligne seraient illisibles.
 */
export function PatternTag({ pattern, className }: { pattern: Pattern; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded bg-surface-2 px-1.5 py-0.5 font-mono text-2xs font-semibold tracking-wider text-muted',
        className,
      )}
    >
      {pattern}
    </span>
  );
}

export function TierTag({ tier, className }: { tier: 1 | 2 | 3; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded border border-border px-1.5 py-0.5 text-2xs font-medium text-muted tnum',
        className,
      )}
    >
      T{tier}
    </span>
  );
}

/** Badge « maîtrisé » — icône + libellé, jamais la couleur seule. */
export function MasteredBadge({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full bg-success-subtle px-2 py-0.5 text-2xs font-medium text-success-text',
        className,
      )}
    >
      <Check aria-hidden="true" className="size-3" strokeWidth={2} />
      Maîtrisé
    </span>
  );
}

export function FavoriteBadge({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full bg-accent-subtle px-2 py-0.5 text-2xs font-medium text-accent-text',
        className,
      )}
    >
      <Star aria-hidden="true" className="size-3" strokeWidth={2} />
      Favori
    </span>
  );
}
