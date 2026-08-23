import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, RotateCcw } from 'lucide-react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { GroupChip, PatternTag } from '@/components/ui/Tags';
import { getVerb, verbs } from '@/data/verbs';
import { GROUP_META } from '@/lib/groups';
import { formatCount, formatPercent, formatSeconds } from '@/lib/format';
import { computeOverview } from '@/lib/stats';
import {
  boxDistribution,
  byHuitoGroup,
  byPattern,
  dailySeries,
  heatmap,
  topMissed,
  type DayPoint,
  type GroupStat,
  type HeatmapCell,
} from '@/lib/stats-detail';
import { useProgress } from '@/store/progress';
import { useLastConfig, useSession } from '@/store/session';
import { cx } from '@/lib/cx';

const dayFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const fullDayFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' });

export function StatsPage() {
  const byVerb = useProgress((state) => state.byVerb);
  const sessions = useProgress((state) => state.sessions);
  const navigate = useNavigate();
  const start = useSession((state) => state.start);
  const lastConfig = useLastConfig((state) => state.config);

  const overview = useMemo(() => computeOverview({ byVerb, sessions }), [byVerb, sessions]);
  const series = useMemo(() => dailySeries(sessions, 30), [sessions]);
  const grid = useMemo(() => heatmap(sessions, 12), [sessions]);
  const missed = useMemo(() => topMissed(sessions, byVerb), [byVerb, sessions]);
  const patterns = useMemo(() => byPattern(verbs, byVerb), [byVerb]);
  const groups = useMemo(() => byHuitoGroup(verbs, byVerb), [byVerb]);
  const boxes = useMemo(() => boxDistribution(byVerb), [byVerb]);

  const totalQuestions = sessions.reduce((sum, session) => sum + session.questionCount, 0);
  const avgMs =
    sessions.length === 0
      ? 0
      : Math.round(
          sessions.reduce((sum, session) => sum + session.avgMs * session.questionCount, 0) /
            Math.max(1, totalQuestions),
        );

  if (sessions.length === 0) {
    return (
      <div className="space-y-6">
        <PageTitle title="Statistiques" />
        <EmptyState
          icon={BarChart3}
          title="Aucune session terminée"
          description="Les statistiques se construisent à partir de tes sessions : précision jour par jour, assiduité, verbes les plus ratés. Lance un entraînement, elles apparaîtront ici."
          action={
            <ButtonLink to="/quiz" size="sm" variant="primary">
              Lancer un entraînement
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const replayMissed = () => {
    const verbIds = missed.map((item) => item.verbId).filter((id) => getVerb(id) !== undefined);
    if (verbIds.length === 0) return;
    const count = start({
      ...lastConfig,
      scope: { kind: 'manual', verbIds },
      questionCount: Math.max(verbIds.length, 5),
      allowRepeats: verbIds.length < 5,
      seed: 0,
    });
    if (count > 0) void navigate('/quiz/run');
  };

  return (
    <div className="space-y-10">
      <PageTitle
        title="Statistiques"
        description={`${formatCount(sessions.length)} sessions · ${formatCount(totalQuestions)} questions posées.`}
      />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          label="Verbes maîtrisés"
          value={`${formatCount(overview.masteredCount)} / ${formatCount(verbs.length)}`}
        />
        <Metric label="Verbes rencontrés" value={formatCount(overview.seenCount)} />
        <Metric label="Précision · 7 jours" value={formatPercent(overview.accuracy7d)} />
        <Metric label="Temps moyen" value={formatSeconds(avgMs)} />
      </dl>

      <Section title="Précision, 30 derniers jours">
        <AccuracyChart series={series} />
      </Section>

      <Section title="Assiduité, 12 dernières semaines">
        <Heatmap grid={grid} />
      </Section>

      {missed.length > 0 ? (
        <Section
          title="Verbes les plus ratés"
          action={
            <Button size="sm" variant="primary" onClick={replayMissed}>
              <RotateCcw aria-hidden="true" className="size-4" strokeWidth={2} />
              Rejouer ces verbes
            </Button>
          }
        >
          <ol className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border">
            {missed.map((item, index) => {
              const verb = getVerb(item.verbId);
              return (
                <li key={item.verbId}>
                  <Link
                    to={`/verbs/${item.verbId}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-surface px-4 py-3 hover:bg-surface-2"
                  >
                    <span className="tnum w-5 text-sm text-muted">{index + 1}</span>
                    <span lang="en" className="font-semibold">
                      {verb?.base ?? item.verbId}
                    </span>
                    <span className="text-sm text-muted">{verb?.fr.join(', ')}</span>
                    {verb ? <PatternTag pattern={verb.pattern} /> : null}
                    <span className="tnum ml-auto text-sm text-muted">
                      raté {formatCount(item.misses)}×
                    </span>
                    <span className="tnum w-14 text-right text-sm font-semibold">
                      {formatPercent(item.accuracy)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </Section>
      ) : null}

      <Section title="Précision par schéma">
        <Breakdown
          stats={patterns}
          render={(key) => <PatternTag pattern={key} />}
          emptyLabel="Aucun schéma travaillé pour l'instant."
        />
      </Section>

      <Section title="Précision par groupe Huito">
        <Breakdown
          stats={groups}
          render={(key) => <GroupChip group={key} />}
          emptyLabel="Aucun groupe travaillé pour l'instant."
          describe={(key) => GROUP_META[key].description}
        />
      </Section>

      <Section title="Répartition SRS">
        <p className="text-xs text-muted">
          Boîtes de Leitner : une réussite fait monter d'une boîte, une erreur fait
          redescendre. Les intervalles de révision vont de 1 à 16 jours.
        </p>
        <ul className="grid grid-cols-5 gap-2">
          {boxes.map((box) => {
            const max = Math.max(1, ...boxes.map((item) => item.count));
            return (
              <li
                key={box.box}
                className="flex flex-col items-center gap-1 rounded-[var(--radius-card)] border border-border bg-surface px-2 py-3"
              >
                <span
                  aria-hidden="true"
                  className="w-full rounded-sm bg-accent"
                  style={{ height: `${Math.max(2, (box.count / max) * 48)}px` }}
                />
                <span className="tnum text-sm font-semibold">{formatCount(box.count)}</span>
                <span className="text-2xs text-muted">Boîte {box.box}</span>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}

/**
 * Courbe de précision en SVG inline — pas de bibliothèque de graphiques pour
 * 30 points. Les jours sans session ne sont pas reliés : la ligne s'interrompt
 * plutôt que de suggérer une continuité qui n'existe pas.
 * Un tableau équivalent, masqué visuellement, porte les mêmes données pour les
 * lecteurs d'écran.
 */
function AccuracyChart({ series }: { series: DayPoint[] }) {
  const width = 720;
  const height = 160;
  const padding = { top: 12, right: 8, bottom: 20, left: 32 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const points = series.map((point, index) => ({
    ...point,
    x: padding.left + (series.length === 1 ? 0 : (index / (series.length - 1)) * innerWidth),
    y:
      point.accuracy === null
        ? null
        : padding.top + innerHeight - point.accuracy * innerHeight,
  }));

  // Segments continus : chaque suite de jours renseignés forme sa propre ligne.
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (const point of points) {
    if (point.y === null) {
      if (current.length > 0) segments.push(current);
      current = [];
    } else {
      current.push({ x: point.x, y: point.y });
    }
  }
  if (current.length > 0) segments.push(current);

  const withData = series.filter((point) => point.accuracy !== null);
  // Bornes de l'axe des abscisses, tirées de la série elle-même : aucune lecture
  // d'horloge pendant le rendu.
  const first = series[0];
  const last = series[series.length - 1];
  const firstLabel = first ? dayFormatter.format(first.day) : '';
  const lastLabel = last ? dayFormatter.format(last.day) : '';
  if (withData.length === 0) {
    return (
      <p className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-6 text-sm text-muted">
        Aucune session sur les 30 derniers jours.
      </p>
    );
  }

  return (
    <figure className="space-y-2">
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-40 w-full min-w-[420px]"
          role="img"
          aria-label={`Précision quotidienne sur 30 jours, ${formatCount(withData.length)} jours avec au moins une session.`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + innerHeight - ratio * innerHeight;
            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={y}
                  y2={y}
                  stroke="var(--color-border)"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 6}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--color-muted)"
                >
                  {ratio * 100}
                </text>
              </g>
            );
          })}

          {segments.map((segment, index) => (
            <polyline
              key={index}
              points={segment.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke="var(--color-accent-text)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {points.map((point) =>
            point.y === null ? null : (
              <circle
                key={point.day}
                cx={point.x}
                cy={point.y}
                r="3"
                fill="var(--color-accent-text)"
              >
                <title>
                  {`${fullDayFormatter.format(point.day)} — ${formatPercent(point.accuracy)} sur ${formatCount(point.questions)} questions`}
                </title>
              </circle>
            ),
          )}

          <text x={padding.left} y={height - 4} fontSize="10" fill="var(--color-muted)">
            {firstLabel}
          </text>
          <text
            x={width - padding.right}
            y={height - 4}
            textAnchor="end"
            fontSize="10"
            fill="var(--color-muted)"
          >
            {lastLabel}
          </text>
        </svg>
      </div>

      <table className="sr-only">
        <caption>Précision quotidienne sur les 30 derniers jours</caption>
        <thead>
          <tr>
            <th scope="col">Jour</th>
            <th scope="col">Questions</th>
            <th scope="col">Précision</th>
          </tr>
        </thead>
        <tbody>
          {withData.map((point) => (
            <tr key={point.day}>
              <th scope="row">{fullDayFormatter.format(point.day)}</th>
              <td>{formatCount(point.questions)}</td>
              <td>{formatPercent(point.accuracy)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Heatmap d'assiduité. L'intensité est doublée d'un titre au survol et d'un résumé texte. */
function Heatmap({ grid }: { grid: HeatmapCell[][] }) {
  const activeDays = grid.flat().filter((cell) => cell.questions > 0).length;
  const levels = [
    'bg-surface-2',
    'bg-accent/25',
    'bg-accent/50',
    'bg-accent/75',
    'bg-accent',
  ] as const;

  return (
    <figure className="space-y-2">
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface p-3">
        <div className="flex gap-1" role="img" aria-label={`Assiduité : ${formatCount(activeDays)} jours travaillés sur les 12 dernières semaines.`}>
          {grid.map((week) => (
            <div key={week[0]?.day} className="flex flex-col gap-1">
              {week.map((cell) => (
                <span
                  key={cell.day}
                  className={cx('size-3 rounded-[3px]', levels[cell.level])}
                  title={`${fullDayFormatter.format(cell.day)} — ${
                    cell.questions === 0
                      ? 'aucune question'
                      : `${formatCount(cell.questions)} questions`
                  }`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="tnum text-xs text-muted">
        {formatCount(activeDays)} jours travaillés sur les 84 derniers.
      </figcaption>
    </figure>
  );
}

function Breakdown<K extends string>({
  stats,
  render,
  emptyLabel,
  describe,
}: {
  stats: GroupStat<K>[];
  render: (key: K) => React.ReactNode;
  emptyLabel: string;
  describe?: (key: K) => string;
}) {
  const worked = stats.filter((stat) => stat.attempts > 0);
  if (worked.length === 0) {
    return (
      <p className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-4 text-sm text-muted">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border">
      {worked.map((stat) => (
        <li
          key={stat.key}
          className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-surface px-4 py-3"
          title={describe?.(stat.key)}
        >
          {render(stat.key)}
          <span className="tnum text-xs text-muted">
            {formatCount(stat.seen)} / {formatCount(stat.total)} verbes vus
          </span>

          <div className="ml-auto flex items-center gap-3">
            <span
              aria-hidden="true"
              className="hidden h-2 w-24 overflow-hidden rounded-full bg-surface-2 sm:block"
            >
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${(stat.accuracy ?? 0) * 100}%` }}
              />
            </span>
            <span className="tnum text-xs text-muted">
              {formatCount(stat.correct)} / {formatCount(stat.attempts)}
            </span>
            <span className="tnum w-12 text-right text-sm font-semibold">
              {formatPercent(stat.accuracy)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-muted">{title}</h2>
        {action ? <div className="ml-auto">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface px-3 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tnum mt-1 text-xl font-bold">{value}</dd>
    </div>
  );
}
