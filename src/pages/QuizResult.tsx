import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { GroupChip, PatternTag } from '@/components/ui/Tags';
import { getVerb } from '@/data/verbs';
import { GROUP_META } from '@/lib/groups';
import { formatCount, formatPercent, formatSeconds, formatVariants } from '@/lib/format';
import { sessionTotals, useSession } from '@/store/session';
import { MODE_LABEL } from '@/quiz/types';
import type { HuitoGroup, Pattern } from '@/data/schema';

export function QuizResultPage() {
  const navigate = useNavigate();
  const attempts = useSession((state) => state.attempts);
  const config = useSession((state) => state.config);
  const bestCombo = useSession((state) => state.bestCombo);
  const start = useSession((state) => state.start);

  const totals = useMemo(() => sessionTotals(attempts), [attempts]);

  if (attempts.length === 0) {
    return (
      <div className="space-y-6">
        <PageTitle title="Résultats" />
        <EmptyState
          icon={RotateCcw}
          title="Aucune session terminée"
          description="Les résultats s'affichent à la fin d'une session. Paramètre une session pour commencer."
          action={
            <ButtonLink to="/quiz" size="sm" variant="primary">
              Paramétrer une session
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const missed = attempts.filter((attempt) => !attempt.result.correct);

  const replayMistakes = () => {
    if (totals.missedVerbIds.length === 0) return;
    const count = start({
      ...config,
      scope: { kind: 'manual', verbIds: totals.missedVerbIds },
      questionCount: Math.max(totals.missedVerbIds.length, 5),
      allowRepeats: totals.missedVerbIds.length < 5,
      seed: 0,
    });
    if (count > 0) void navigate('/quiz/run');
  };

  return (
    <div className="space-y-8">
      <PageTitle
        title="Résultats"
        description={`${config.modes.map((mode) => MODE_LABEL[mode]).join(' · ')} — ${formatCount(totals.questionCount)} questions.`}
      />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Score" value={formatCount(totals.score)} />
        <Stat
          label="Bonnes réponses"
          value={`${formatCount(totals.correctCount)} / ${formatCount(totals.questionCount)}`}
        />
        <Stat label="Précision" value={formatPercent(totals.accuracy)} />
        <Stat label="Temps moyen" value={formatSeconds(totals.avgMs)} />
        {bestCombo >= 5 ? (
          <Stat label="Meilleur combo" value={`×${formatCount(bestCombo)}`} />
        ) : null}
      </dl>

      {missed.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-success/40 bg-success-subtle px-4 py-4 text-sm text-success-text">
          Aucune erreur sur cette session.
        </p>
      ) : (
        <section aria-labelledby="errors-heading" className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="errors-heading" className="text-sm font-semibold text-muted">
              Erreurs à revoir ({formatCount(totals.missedVerbIds.length)} verbes)
            </h2>
            <Button size="sm" variant="primary" className="ml-auto" onClick={replayMistakes}>
              <RotateCcw aria-hidden="true" className="size-4" strokeWidth={2} />
              Refaire uniquement ces verbes
            </Button>
          </div>

          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border">
            {missed.map((attempt) => (
              <li key={attempt.questionId} className="space-y-2 bg-surface px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-2xs text-muted">{MODE_LABEL[attempt.mode]}</span>
                  {attempt.result.kind === 'timeout' ? (
                    <span className="text-2xs text-danger-text">Temps écoulé</span>
                  ) : null}
                  {attempt.result.kind === 'near-spelling' ? (
                    <span className="text-2xs text-warning-text">Presque — orthographe</span>
                  ) : null}
                </div>

                {attempt.verbIds.map((verbId) => {
                  const verb = getVerb(verbId);
                  if (!verb) return null;
                  return (
                    <div key={verbId} className="space-y-1">
                      <p className="flex flex-wrap items-baseline gap-2">
                        <span lang="en" className="text-base font-semibold">
                          {verb.base} · {formatVariants(verb.past)} ·{' '}
                          {formatVariants(verb.participle)}
                        </span>
                        <span className="text-sm text-muted">{verb.fr.join(', ')}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <PatternTag pattern={verb.pattern} />
                        {verb.huitoGroup ? <GroupChip group={verb.huitoGroup} /> : null}
                      </div>
                      {verb.note ? (
                        <p className="flex items-start gap-2 rounded-[var(--radius-field)] bg-warning-subtle px-3 py-2 text-sm text-warning-text">
                          <AlertTriangle
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0"
                            strokeWidth={2}
                          />
                          {verb.note}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Breakdown
        title="Précision par schéma"
        entries={Object.entries(totals.accuracyByPattern)}
        render={(key) => <PatternTag pattern={key as Pattern} />}
      />

      <Breakdown
        title="Précision par groupe Huito"
        entries={Object.entries(totals.accuracyByGroup)}
        render={(key) =>
          key in GROUP_META ? <GroupChip group={key as HuitoGroup} /> : <span>{key}</span>
        }
      />

      <div className="flex flex-wrap gap-3">
        <ButtonLink to="/quiz" variant="primary">
          Nouvelle session
        </ButtonLink>
        <ButtonLink to="/stats">Voir les statistiques</ButtonLink>
      </div>
    </div>
  );
}

function Breakdown({
  title,
  entries,
  render,
}: {
  title: string;
  entries: [string, { correct: number; total: number }][];
  render: (key: string) => React.ReactNode;
}) {
  if (entries.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted">{title}</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border">
        {entries
          .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
          .map(([key, value]) => (
            <li key={key} className="flex items-center gap-3 bg-surface px-4 py-2.5">
              {render(key)}
              <span className="tnum ml-auto text-sm text-muted">
                {formatCount(value.correct)} / {formatCount(value.total)}
              </span>
              <span className="tnum w-12 text-right text-sm font-semibold">
                {formatPercent(value.correct / value.total)}
              </span>
            </li>
          ))}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface px-3 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tnum mt-1 text-xl font-bold">{value}</dd>
    </div>
  );
}
