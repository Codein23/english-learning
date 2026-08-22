import { useEffect, useRef } from 'react';
import type { VerbForm } from '@/data/schema';
import type { CheckResult, InputQuestion } from '@/quiz/types';
import { SpeakButton } from '@/components/ui/SpeakButton';
import { cx } from '@/lib/cx';

/** Saisie libre, complétion de triplet, traduction Expert, dictée Expert. */
export function Fields({
  question,
  values,
  revealed,
  result,
  hints,
  onChange,
  onSubmit,
}: {
  question: InputQuestion;
  values: Partial<Record<VerbForm, string>>;
  revealed: boolean;
  result: CheckResult | null;
  hints: Partial<Record<VerbForm, string>>;
  onChange: (key: VerbForm, value: string) => void;
  onSubmit: () => void;
}) {
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!revealed) firstField.current?.focus();
  }, [question.id, revealed]);

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!revealed) onSubmit();
      }}
    >
      <div className="flex items-start gap-2">
        <p
          className={cx('font-semibold', question.mode === 'dictation' ? 'text-base' : 'text-2xl')}
          lang={question.promptLang}
        >
          {question.prompt}
        </p>
        {question.spoken ? (
          <SpeakButton text={question.spoken} label="Réécouter" size="sm" />
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {question.fields.map((field, index) => {
          const verdict = result?.perField?.find((entry) => entry.key === field.key);
          return (
            <div key={field.key} className="space-y-1.5">
              <label
                htmlFor={`${question.id}-${field.key}`}
                className="block text-sm font-medium"
              >
                {field.label}
              </label>
              <input
                id={`${question.id}-${field.key}`}
                ref={index === 0 ? firstField : undefined}
                type="text"
                value={values[field.key] ?? ''}
                onChange={(event) => onChange(field.key, event.target.value)}
                disabled={revealed}
                lang="en"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className={cx(
                  'h-12 w-full rounded-[var(--radius-field)] border bg-surface px-3 text-base transition-colors duration-150 ease-out',
                  verdict?.correct === true && 'border-success bg-success-subtle',
                  verdict !== undefined &&
                    !verdict.correct &&
                    'border-danger bg-danger-subtle',
                  verdict === undefined && 'border-border hover:border-border-strong',
                )}
              />
              {hints[field.key] ? (
                <p className="text-xs text-muted">
                  Indice : <span className="font-semibold text-ink">{hints[field.key]}</span>
                </p>
              ) : null}
              {verdict !== undefined && !verdict.correct ? (
                <p className="text-xs text-danger-text">
                  {verdict.kind === 'near-spelling'
                    ? `Presque — orthographe. Attendu : ${verdict.expected}`
                    : `Attendu : ${verdict.expected}`}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {!revealed ? (
        <button
          type="submit"
          className="inline-flex h-11 items-center rounded-[var(--radius-field)] bg-ink px-4 font-medium text-bg transition-colors duration-150 ease-out hover:bg-ink/90"
        >
          Valider
        </button>
      ) : null}
    </form>
  );
}
