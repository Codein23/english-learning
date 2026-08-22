import { Check, X } from 'lucide-react';
import { normalizeAnswer } from '@/quiz/check';
import type { McqQuestion } from '@/quiz/types';
import { SpeakButton } from '@/components/ui/SpeakButton';
import { cx } from '@/lib/cx';

/** QCM, traduction en QCM, dictée en QCM et Speed Run partagent ce rendu. */
export function Choices({
  question,
  revealed,
  chosen,
  hint,
  onChoose,
}: {
  question: McqQuestion;
  revealed: boolean;
  chosen: string | null;
  hint: string | null;
  onChoose: (value: string) => void;
}) {
  const accepted = question.accepted.map(normalizeAnswer);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2">
        <p className="text-xl font-semibold" lang={question.promptLang}>
          {question.prompt}
        </p>
        {question.spoken ? (
          <SpeakButton text={question.spoken} label="Écouter la forme" size="sm" />
        ) : null}
      </div>

      {hint ? (
        <p className="text-sm text-muted">
          Indice : commence par <span className="font-semibold text-ink">{hint}</span>
        </p>
      ) : null}

      <ul className="grid gap-2 sm:grid-cols-2">
        {question.choices.map((choice) => {
          const isCorrect = accepted.includes(normalizeAnswer(choice));
          const isChosen = chosen === choice;
          const state = !revealed
            ? 'idle'
            : isCorrect
              ? 'correct'
              : isChosen
                ? 'wrong'
                : 'idle';

          return (
            <li key={choice}>
              <button
                type="button"
                onClick={() => onChoose(choice)}
                disabled={revealed}
                lang={question.choicesLang}
                className={cx(
                  'flex min-h-12 w-full items-center justify-between gap-2 rounded-[var(--radius-field)] border px-4 py-2 text-left text-base transition-colors duration-150 ease-out',
                  state === 'correct' && 'border-success bg-success-subtle text-success-text',
                  state === 'wrong' && 'border-danger bg-danger-subtle text-danger-text',
                  state === 'idle' &&
                    (isChosen
                      ? 'border-accent bg-accent-subtle text-accent-text'
                      : 'border-border bg-surface hover:border-border-strong disabled:opacity-60'),
                )}
              >
                <span>{choice}</span>
                {state === 'correct' ? (
                  <Check aria-hidden="true" className="size-4 shrink-0" strokeWidth={2} />
                ) : null}
                {state === 'wrong' ? (
                  <X aria-hidden="true" className="size-4 shrink-0" strokeWidth={2} />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
