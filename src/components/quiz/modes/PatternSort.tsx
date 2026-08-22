import { useMemo, useState } from 'react';
import { PATTERNS, type Pattern } from '@/data/schema';
import { PATTERN_EXAMPLE } from '@/lib/groups';
import type { PatternSortQuestion } from '@/quiz/types';
import { Button } from '@/components/ui/Button';
import { cx } from '@/lib/cx';

/** Tri par schéma (§6.9) : chaque verbe rejoint l'un des cinq buckets. */
export function PatternSort({
  question,
  revealed,
  onSubmit,
}: {
  question: PatternSortQuestion;
  revealed: boolean;
  onSubmit: (assignment: Record<string, Pattern | null>) => void;
}) {
  const empty = useMemo<Record<string, Pattern | null>>(
    () => Object.fromEntries(question.items.map((item) => [item.verbId, null])),
    [question],
  );
  const [assignment, setAssignment] = useState(empty);

  const complete = question.items.every((item) => assignment[item.verbId] !== null);

  return (
    <div className="space-y-5">
      <ul className="space-y-2">
        {question.items.map((item) => {
          const chosen = assignment[item.verbId] ?? null;
          const correct = revealed ? chosen === item.pattern : null;

          return (
            <li
              key={item.verbId}
              className={cx(
                'rounded-[var(--radius-card)] border bg-surface px-3 py-3',
                correct === true && 'border-success',
                correct === false && 'border-danger',
                correct === null && 'border-border',
              )}
            >
              <p lang="en" className="text-base font-semibold">
                {item.base} · {item.past} · {item.participle}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PATTERNS.map((pattern) => (
                  <button
                    key={pattern}
                    type="button"
                    disabled={revealed}
                    onClick={() =>
                      setAssignment((current) => ({ ...current, [item.verbId]: pattern }))
                    }
                    title={PATTERN_EXAMPLE[pattern]}
                    aria-pressed={chosen === pattern}
                    className={cx(
                      'h-9 rounded-full border px-3 font-mono text-xs font-semibold tracking-wider transition-colors duration-150 ease-out',
                      chosen === pattern
                        ? 'border-accent bg-accent-subtle text-accent-text'
                        : 'border-border text-muted hover:border-border-strong hover:text-ink',
                    )}
                  >
                    {pattern}
                  </button>
                ))}
              </div>
              {revealed && correct === false ? (
                <p className="mt-2 text-xs text-danger-text">
                  Attendu : <span className="font-mono font-semibold">{item.pattern}</span>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {!revealed ? (
        <Button variant="primary" disabled={!complete} onClick={() => onSubmit(assignment)}>
          Valider le tri
        </Button>
      ) : null}
    </div>
  );
}
