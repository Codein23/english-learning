import { useMemo } from 'react';
import { ArrowRight, Flame, Play, Target, Trophy, type LucideIcon } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { PageTitle } from '@/components/ui/PageTitle';
import { countByPattern, verbs } from '@/data/verbs';
import { PATTERN_EXAMPLE } from '@/lib/groups';
import { formatCount, formatPercent } from '@/lib/format';
import { computeOverview } from '@/lib/stats';
import { useProgress } from '@/store/progress';
import { PATTERNS } from '@/data/schema';

export function HomePage() {
  const byVerb = useProgress((state) => state.byVerb);
  const sessions = useProgress((state) => state.sessions);
  const overview = useMemo(() => computeOverview({ byVerb, sessions }), [byVerb, sessions]);

  const neverStarted = overview.totalSessions === 0;

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <PageTitle
          title="Verbes irréguliers anglais"
          description={`${formatCount(verbs.length)} verbes, 9 modes d'entraînement, progression enregistrée sur cet appareil. Aucun compte, fonctionne hors ligne.`}
        />
        <div className="flex flex-wrap gap-3">
          <ButtonLink to="/quiz" variant="primary" size="lg">
            <Play aria-hidden="true" className="size-4" strokeWidth={2} />
            Lancer un entraînement
          </ButtonLink>
          <ButtonLink to="/verbs" size="lg">
            Consulter le tableau
            <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2} />
          </ButtonLink>
        </div>
      </header>

      <section aria-labelledby="progress-heading" className="space-y-3">
        <h2 id="progress-heading" className="text-sm font-semibold text-muted">
          Progression
        </h2>

        {neverStarted ? (
          <p className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-5 text-sm text-muted">
            Aucune session pour l'instant. Les statistiques apparaissent dès le premier
            entraînement terminé — rien n'est envoyé sur un serveur, tout reste sur cet
            appareil.
          </p>
        ) : null}

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric
            icon={Trophy}
            label="Verbes maîtrisés"
            value={`${formatCount(overview.masteredCount)} / ${formatCount(verbs.length)}`}
            hint="3 réussites d'affilée sans indice, boîte SRS ≥ 4"
          />
          <Metric
            icon={Target}
            label="Précision · 7 jours"
            value={formatPercent(overview.accuracy7d)}
            hint={
              overview.accuracy7d === null
                ? 'Aucune session cette semaine'
                : `${formatCount(overview.seenCount)} verbes déjà rencontrés`
            }
          />
          <Metric
            icon={Flame}
            label="Série"
            value={
              overview.streakDays === 0
                ? '—'
                : `${formatCount(overview.streakDays)} ${overview.streakDays > 1 ? 'jours' : 'jour'}`
            }
            hint="Jours consécutifs avec au moins une session"
          />
        </dl>
      </section>

      <section aria-labelledby="patterns-heading" className="space-y-3">
        <h2 id="patterns-heading" className="text-sm font-semibold text-muted">
          Les cinq schémas de conjugaison
        </h2>
        <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border">
          {PATTERNS.map((pattern) => (
            <li
              key={pattern}
              className="flex items-baseline justify-between gap-4 bg-surface px-4 py-3"
            >
              <span className="font-mono text-sm font-semibold tracking-wider">{pattern}</span>
              <span lang="en" className="min-w-0 flex-1 truncate text-sm text-muted">
                {PATTERN_EXAMPLE[pattern]}
              </span>
              <span className="tnum text-sm text-muted">
                {formatCount(countByPattern.get(pattern) ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-4">
      <dt className="flex items-center gap-2 text-sm text-muted">
        <Icon aria-hidden className="size-4" strokeWidth={1.75} />
        {label}
      </dt>
      <dd className="mt-2 tnum text-2xl font-bold">{value}</dd>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}
