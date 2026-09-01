import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lightbulb, X } from 'lucide-react';
import type { VerbForm } from '@/data/schema';
import { Button } from '@/components/ui/Button';
import { Feedback } from '@/components/quiz/Feedback';
import { QuestionTimer, SessionTimer } from '@/components/quiz/Timer';
import { Choices } from '@/components/quiz/modes/Choices';
import { Fields } from '@/components/quiz/modes/Fields';
import { Flashcard } from '@/components/quiz/modes/Flashcard';
import { Matching } from '@/components/quiz/modes/Matching';
import { PatternSort } from '@/components/quiz/modes/PatternSort';
import { useAudio } from '@/lib/useAudio';
import { formatCount } from '@/lib/format';
import { useSession } from '@/store/session';
import type { AnswerInput } from '@/quiz/check';
import { MODE_LABEL, type CheckResult, type Question } from '@/quiz/types';

export function QuizRunPage() {
  const navigate = useNavigate();
  const status = useSession((state) => state.status);
  const questions = useSession((state) => state.questions);
  const index = useSession((state) => state.index);
  const config = useSession((state) => state.config);
  const lastResult = useSession((state) => state.lastResult);
  const hintUsed = useSession((state) => state.hintUsed);
  const combo = useSession((state) => state.combo);
  const startedAt = useSession((state) => state.startedAt);
  const submit = useSession((state) => state.submit);
  const next = useSession((state) => state.next);
  const useHint = useSession((state) => state.useHint);
  const finish = useSession((state) => state.finish);
  const abandon = useSession((state) => state.abandon);

  const audio = useAudio();
  const question = questions[index];
  const revealed = lastResult !== null;

  // Session terminée ou abandonnée : on redirige plutôt que d'afficher un écran vide.
  useEffect(() => {
    if (status === 'finished') void navigate('/quiz/result', { replace: true });
    if (status === 'idle') void navigate('/quiz', { replace: true });
  }, [navigate, status]);

  // En dictée audio, la forme doit partir dès l'arrivée sur chaque question.
  useEffect(() => {
    if (
      revealed ||
      !config.audioOnReveal ||
      !audio.available ||
      !question ||
      question.mode !== 'dictation' ||
      !question.spoken
    ) {
      return;
    }
    audio.speak(question.spoken);
  }, [audio, config.audioOnReveal, question, revealed]);

  // Lecture automatique de la bonne forme au dévoilement (§9.4).
  useEffect(() => {
    if (!revealed || !config.audioOnReveal || !audio.available || !question) return;
    const spoken =
      'accepted' in question
        ? question.accepted[0]
        : 'fields' in question
          ? question.fields[0]?.accepted[0]
          : undefined;
    if (spoken) audio.speak(spoken);
  }, [audio, config.audioOnReveal, question, revealed]);

  const handleAdvance = useCallback(() => {
    const nextQuestion = questions[index + 1];
    if (
      nextQuestion &&
      config.audioOnReveal &&
      audio.available &&
      nextQuestion.mode === 'dictation' &&
      nextQuestion.spoken
    ) {
      audio.speak(nextQuestion.spoken);
    }
    if (index + 1 >= questions.length) finish();
    else next();
  }, [audio, config.audioOnReveal, finish, index, next, questions]);

  const answer = useCallback(
    (input: AnswerInput) => {
      const result = submit(input);
      // Sans correction immédiate, on enchaîne sans marquer de temps d'arrêt.
      if (result && !config.immediateFeedback) handleAdvance();
    },
    [config.immediateFeedback, handleAdvance, submit],
  );

  const onTimeout = useCallback(() => {
    if (lastResult !== null) return;
    answer({ kind: 'timeout' });
  }, [answer, lastResult]);

  if (!question) return null;

  const hintAvailable =
    config.firstLetterHint && config.difficulty !== 'expert' && !hintUsed && !revealed;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="tnum text-sm font-medium">
            Question {formatCount(index + 1)} / {formatCount(questions.length)}
          </p>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-medium text-muted">
            {MODE_LABEL[question.mode]}
          </span>

          {combo >= 5 ? (
            <span className="tnum rounded-full bg-accent-subtle px-2 py-0.5 text-2xs font-medium text-accent-text">
              Combo ×{combo}
            </span>
          ) : null}

          <div className="ml-auto flex items-center gap-3">
            {config.sessionSeconds !== null ? (
              <SessionTimer
                seconds={config.sessionSeconds}
                startedAt={startedAt}
                onExpire={finish}
              />
            ) : null}
            {config.perQuestionSeconds !== null ? (
              <QuestionTimer
                key={question.id}
                seconds={config.perQuestionSeconds}
                questionId={question.id}
                paused={revealed}
                onExpire={onTimeout}
              />
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                abandon();
                void navigate('/quiz');
              }}
            >
              <X aria-hidden="true" className="size-4" strokeWidth={2} />
              Quitter
            </Button>
          </div>
        </div>

        <div
          className="h-1 w-full overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-valuenow={index}
          aria-label="Progression de la session"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-150 ease-out"
            style={{ width: `${((index + (revealed ? 1 : 0)) / questions.length) * 100}%` }}
          />
        </div>
      </header>

      <div className="min-h-72">
        <QuestionArea
          key={question.id}
          question={question}
          revealed={revealed}
          result={lastResult}
          hintUsed={hintUsed}
          onAnswer={answer}
        />
      </div>

      {/* La place du feedback est réservée : révéler la correction ne décale rien. */}
      <div className="min-h-28">
        {revealed && config.immediateFeedback ? <Feedback result={lastResult} /> : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {hintAvailable ? (
          <Button size="sm" onClick={useHint}>
            <Lightbulb aria-hidden="true" className="size-4" strokeWidth={1.75} />
            Indice (−25 pts)
          </Button>
        ) : null}

        {revealed && config.immediateFeedback ? (
          <Button variant="primary" onClick={handleAdvance} autoFocus>
            {index + 1 >= questions.length ? 'Voir les résultats' : 'Question suivante'}
            <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2} />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Zone de question. Montée avec `key={question.id}` : l'état de saisie repart
 * de zéro à chaque question, sans effet de remise à zéro.
 */
function QuestionArea({
  question,
  revealed,
  result,
  hintUsed,
  onAnswer,
}: {
  question: Question;
  revealed: boolean;
  result: CheckResult | null;
  hintUsed: boolean;
  onAnswer: (input: AnswerInput) => void;
}) {
  const [choice, setChoice] = useState<string | null>(null);
  const [values, setValues] = useState<Partial<Record<VerbForm, string>>>({});

  const fieldHints = useMemo<Partial<Record<VerbForm, string>>>(() => {
    if (!hintUsed || !('fields' in question)) return {};
    return Object.fromEntries(
      question.fields.map((field) => [field.key, field.accepted[0]?.slice(0, 1) ?? '']),
    );
  }, [hintUsed, question]);

  if (question.mode === 'matching') {
    return (
      <Matching
        question={question}
        disabled={revealed}
        onComplete={(assignment, mistakes) =>
          onAnswer({ kind: 'matching', assignment, mistakes })
        }
      />
    );
  }

  if (question.mode === 'patternSort') {
    return (
      <PatternSort
        question={question}
        revealed={revealed}
        onSubmit={(assignment) => onAnswer({ kind: 'sort', assignment })}
      />
    );
  }

  if (question.mode === 'flashcard') {
    return (
      <Flashcard
        question={question}
        disabled={revealed}
        onRate={(value) => onAnswer({ kind: 'selfRating', value })}
      />
    );
  }

  if ('choices' in question) {
    return (
      <Choices
        question={question}
        revealed={revealed}
        chosen={choice}
        hint={hintUsed ? (question.accepted[0]?.slice(0, 1) ?? null) : null}
        onChoose={(value) => {
          setChoice(value);
          onAnswer({ kind: 'choice', value });
        }}
      />
    );
  }

  return (
    <Fields
      question={question}
      values={values}
      revealed={revealed}
      result={result}
      hints={fieldHints}
      onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
      onSubmit={() => onAnswer({ kind: 'fields', values })}
    />
  );
}
