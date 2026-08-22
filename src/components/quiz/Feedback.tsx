import { AlertTriangle, Check, Timer, X } from 'lucide-react';
import type { CheckResult } from '@/quiz/types';
import { cx } from '@/lib/cx';

const TONE = {
  correct: {
    icon: Check,
    label: 'Correct',
    className: 'border-success/40 bg-success-subtle text-success-text',
  },
  wrong: {
    icon: X,
    label: 'Faux',
    className: 'border-danger/40 bg-danger-subtle text-danger-text',
  },
  timeout: {
    icon: Timer,
    label: 'Temps écoulé — compté faux',
    className: 'border-danger/40 bg-danger-subtle text-danger-text',
  },
  'near-spelling': {
    icon: AlertTriangle,
    label: 'Presque — orthographe. Compté faux.',
    className: 'border-warning/40 bg-warning-subtle text-warning-text',
  },
  partial: {
    icon: AlertTriangle,
    label: 'Partiellement juste — compté faux',
    className: 'border-warning/40 bg-warning-subtle text-warning-text',
  },
  skipped: {
    icon: X,
    label: 'Sans réponse',
    className: 'border-danger/40 bg-danger-subtle text-danger-text',
  },
} as const;

/**
 * Panneau de correction. Icône + libellé systématiques : la couleur n'est
 * jamais seule porteuse. La `note` du verbe s'affiche dès qu'il est raté.
 */
export function Feedback({ result }: { result: CheckResult }) {
  const tone = TONE[result.kind];
  const Icon = tone.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cx('space-y-2 rounded-[var(--radius-card)] border px-4 py-3', tone.className)}
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={2} />
        {tone.label}
      </p>

      {!result.correct ? (
        <p className="text-sm text-ink">
          Réponse attendue :{' '}
          <span lang="en" className="font-semibold whitespace-pre-line">
            {result.expected}
          </span>
        </p>
      ) : null}

      {result.note ? (
        <p className="flex items-start gap-2 border-t border-current/20 pt-2 text-sm text-ink">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          <span className="whitespace-pre-line">{result.note}</span>
        </p>
      ) : null}
    </div>
  );
}
