import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Star } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { GroupChip, MasteredBadge, PatternTag, TierTag } from '@/components/ui/Tags';
import { getVerb } from '@/data/verbs';
import { PATTERN_EXAMPLE, TIER_LABEL } from '@/lib/groups';
import { formatCount, formatPercent, formatSeconds, formatDayDelta } from '@/lib/format';
import { accuracy, isMastered, useProgress } from '@/store/progress';
import { cx } from '@/lib/cx';
import { NotFoundPage } from './NotFound';

export function VerbDetailPage() {
  const { id = '' } = useParams();
  const verb = getVerb(id);

  const progress = useProgress((state) => state.byVerb[id]);
  const favorite = useProgress((state) => state.favorites.includes(id));
  const toggleFavorite = useProgress((state) => state.toggleFavorite);

  if (!verb) {
    return (
      <NotFoundPage
        title="Verbe introuvable"
        description={`Aucun verbe ne porte l'identifiant « ${id} » dans le dataset.`}
        backTo="/verbs"
        backLabel="Retour au tableau"
      />
    );
  }

  return (
    <article className="space-y-8">
      <div>
        <Link
          to="/verbs"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
          Tableau des verbes
        </Link>
      </div>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 lang="en" className="text-3xl font-bold">
            {verb.base}
          </h1>
          {isMastered(progress) ? <MasteredBadge /> : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => toggleFavorite(verb.id)}
            aria-pressed={favorite}
            className={cx('ml-auto', favorite && 'text-accent-text')}
          >
            <Star
              aria-hidden="true"
              className="size-4"
              strokeWidth={1.75}
              fill={favorite ? 'currentColor' : 'none'}
            />
            {favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          </Button>
        </div>

        <p className="text-base text-muted">{verb.fr.join(', ')}</p>

        <div className="flex flex-wrap items-center gap-1.5">
          <PatternTag pattern={verb.pattern} />
          <TierTag tier={verb.tier} />
          {verb.huitoGroup ? <GroupChip group={verb.huitoGroup} /> : null}
          {verb.rank !== null ? (
            <span className="tnum text-2xs text-muted">
              n°{verb.rank} du top 100 · {TIER_LABEL[verb.tier]}
            </span>
          ) : (
            <span className="text-2xs text-muted">{TIER_LABEL[verb.tier]}</span>
          )}
        </div>
      </header>

      <section aria-labelledby="forms-heading" className="space-y-3">
        <h2 id="forms-heading" className="text-sm font-semibold text-muted">
          Les trois formes
        </h2>
        <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border">
          <FormRow label="Base" values={[verb.base]} />
          <FormRow label="Prétérit" values={verb.past} />
          <FormRow label="Participe passé" values={verb.participle} />
        </ul>
        <p className="text-xs text-muted">
          Schéma {verb.pattern} — {PATTERN_EXAMPLE[verb.pattern]}. Toute variante listée est
          acceptée en correction.
          {verb.ipa === null
            ? ' La transcription phonétique sera ajoutée par le script audio.'
            : null}
        </p>
      </section>

      {verb.note ? (
        <section
          aria-labelledby="note-heading"
          className="rounded-[var(--radius-card)] border border-warning/40 bg-warning-subtle px-4 py-4"
        >
          <h2
            id="note-heading"
            className="flex items-center gap-2 text-sm font-semibold text-warning-text"
          >
            <AlertTriangle aria-hidden="true" className="size-4" strokeWidth={2} />
            Piège à connaître
          </h2>
          <p className="prose-measure mt-2 text-sm">{verb.note}</p>
        </section>
      ) : null}

      {verb.example ? (
        <section aria-labelledby="example-heading" className="space-y-2">
          <h2 id="example-heading" className="text-sm font-semibold text-muted">
            Exemple
          </h2>
          <p lang="en" className="prose-measure text-base">
            {verb.example}
          </p>
        </section>
      ) : null}

      <section aria-labelledby="history-heading" className="space-y-3">
        <h2 id="history-heading" className="text-sm font-semibold text-muted">
          Historique personnel
        </h2>
        {progress === undefined || progress.attempts === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-4 text-sm text-muted">
            Ce verbe n'a encore jamais été posé en session.
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Tentatives" value={formatCount(progress.attempts)} />
            <Stat label="Précision" value={formatPercent(accuracy(progress))} />
            <Stat label="Temps moyen" value={formatSeconds(progress.avgMs)} />
            <Stat label="Boîte SRS" value={`${progress.box} / 5`} />
            <Stat
              label="Dernière rencontre"
              value={formatDayDelta(progress.lastSeen)}
              wide
            />
          </dl>
        )}
      </section>

      <ButtonLink to={`/quiz?verbs=${verb.id}`} variant="primary">
        S'entraîner sur ce verbe
      </ButtonLink>
    </article>
  );
}

function FormRow({ label, values }: { label: string; values: readonly string[] }) {
  return (
    <li className="flex items-baseline gap-4 bg-surface px-4 py-3">
      <span className="w-32 shrink-0 text-sm text-muted">{label}</span>
      <span lang="en" className="text-lg font-semibold">
        {values.join(' · ')}
      </span>
    </li>
  );
}

function Stat({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div
      className={cx(
        'rounded-[var(--radius-card)] border border-border bg-surface px-3 py-3',
        wide && 'col-span-2',
      )}
    >
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tnum mt-1 text-lg font-semibold">{value}</dd>
    </div>
  );
}
