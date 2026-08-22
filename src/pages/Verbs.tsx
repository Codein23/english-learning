import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Search, SearchX, Star, X } from 'lucide-react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { GroupChip, MasteredBadge, PatternTag, TierTag } from '@/components/ui/Tags';
import { countByGroup, countByPattern, countByTier, verbs } from '@/data/verbs';
import { HUITO_GROUPS, PATTERNS, type HuitoGroup, type Pattern, type Verb } from '@/data/schema';
import { GROUP_META, TIER_LABEL } from '@/lib/groups';
import { formatCount, formatVariants } from '@/lib/format';
import { isMastered, useProgress } from '@/store/progress';
import { cx } from '@/lib/cx';

type Tier = 1 | 2 | 3;
type SortKey = 'alpha' | 'rank' | 'pattern';
type Status = 'all' | 'mastered' | 'todo' | 'favorites';

/** Recherche insensible aux accents et à la casse (« présenter » trouve « se présenter »). */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

const searchIndex = new Map<string, string>(
  verbs.map((verb) => [
    verb.id,
    normalize([verb.base, ...verb.past, ...verb.participle, ...verb.fr].join(' ')),
  ]),
);

export function VerbsPage() {
  const [query, setQuery] = useState('');
  const [tiers, setTiers] = useState<Set<Tier>>(new Set());
  const [patterns, setPatterns] = useState<Set<Pattern>>(new Set());
  const [groups, setGroups] = useState<Set<HuitoGroup>>(new Set());
  const [status, setStatus] = useState<Status>('all');
  const [sort, setSort] = useState<SortKey>('alpha');

  const deferredQuery = useDeferredValue(query);
  const byVerb = useProgress((state) => state.byVerb);
  const favorites = useProgress((state) => state.favorites);
  const toggleFavorite = useProgress((state) => state.toggleFavorite);

  const results = useMemo(() => {
    const needle = normalize(deferredQuery.trim());
    const favoriteSet = new Set(favorites);

    const filtered = verbs.filter((verb) => {
      if (needle && !(searchIndex.get(verb.id) ?? '').includes(needle)) return false;
      if (tiers.size > 0 && !tiers.has(verb.tier)) return false;
      if (patterns.size > 0 && !patterns.has(verb.pattern)) return false;
      if (groups.size > 0 && (verb.huitoGroup === null || !groups.has(verb.huitoGroup)))
        return false;

      if (status === 'favorites') return favoriteSet.has(verb.id);
      if (status === 'mastered') return isMastered(byVerb[verb.id]);
      if (status === 'todo') return !isMastered(byVerb[verb.id]);
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'rank') {
        // Les verbes hors top 100 passent après, sans être exclus.
        const rankA = a.rank ?? Number.POSITIVE_INFINITY;
        const rankB = b.rank ?? Number.POSITIVE_INFINITY;
        return rankA === rankB ? a.base.localeCompare(b.base) : rankA - rankB;
      }
      if (sort === 'pattern') {
        return a.pattern === b.pattern
          ? a.base.localeCompare(b.base)
          : a.pattern.localeCompare(b.pattern);
      }
      return a.base.localeCompare(b.base);
    });
  }, [byVerb, deferredQuery, favorites, groups, patterns, sort, status, tiers]);

  const hasFilters =
    query.trim() !== '' ||
    tiers.size > 0 ||
    patterns.size > 0 ||
    groups.size > 0 ||
    status !== 'all';

  const resetFilters = () => {
    setQuery('');
    setTiers(new Set());
    setPatterns(new Set());
    setGroups(new Set());
    setStatus('all');
  };

  return (
    <div className="space-y-6">
      <PageTitle
        title="Tableau des verbes"
        description={`Les ${formatCount(verbs.length)} verbes du dataset, avec leurs variantes acceptées, leur schéma et leur groupe pédagogique.`}
      />

      <div className="space-y-4">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            strokeWidth={1.75}
          />
          <label htmlFor="verb-search" className="sr-only">
            Rechercher un verbe, une forme ou une traduction
          </label>
          <input
            id="verb-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="eat, ate, manger…"
            autoComplete="off"
            className="h-11 w-full rounded-[var(--radius-field)] border border-border bg-surface pr-4 pl-9 text-base text-ink transition-colors duration-150 ease-out placeholder:text-muted hover:border-border-strong focus:border-border-strong"
          />
        </div>

        <FilterRow label="Statut">
          {(
            [
              ['all', 'Tous'],
              ['todo', 'À travailler'],
              ['mastered', 'Maîtrisés'],
              ['favorites', 'Favoris'],
            ] as const
          ).map(([value, label]) => (
            <Chip key={value} active={status === value} onClick={() => setStatus(value)}>
              {label}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Fréquence">
          {([1, 2, 3] as const).map((tier) => (
            <Chip
              key={tier}
              active={tiers.has(tier)}
              onClick={() => setTiers(toggleIn(tiers, tier))}
              title={TIER_LABEL[tier]}
            >
              Tier {tier}
              <Count value={countByTier.get(tier) ?? 0} />
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Schéma">
          {PATTERNS.map((pattern) => (
            <Chip
              key={pattern}
              active={patterns.has(pattern)}
              onClick={() => setPatterns(toggleIn(patterns, pattern))}
            >
              <span className="font-mono tracking-wider">{pattern}</span>
              <Count value={countByPattern.get(pattern) ?? 0} />
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Groupe Huito">
          {HUITO_GROUPS.map((group) => (
            <Chip
              key={group}
              active={groups.has(group)}
              onClick={() => setGroups(toggleIn(groups, group))}
              title={GROUP_META[group].description}
            >
              {GROUP_META[group].label}
              <Count value={countByGroup.get(group) ?? 0} />
            </Chip>
          ))}
        </FilterRow>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <p aria-live="polite" className="tnum text-sm text-muted">
            {formatCount(results.length)}{' '}
            {results.length > 1 ? 'verbes affichés' : 'verbe affiché'}
          </p>

          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="verb-sort" className="text-sm text-muted">
              Trier par
            </label>
            <select
              id="verb-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="h-9 rounded-[var(--radius-field)] border border-border bg-surface px-2 text-sm text-ink hover:border-border-strong"
            >
              <option value="alpha">Ordre alphabétique</option>
              <option value="rank">Fréquence</option>
              <option value="pattern">Schéma</option>
            </select>
          </div>

          {hasFilters ? (
            <Button size="sm" variant="ghost" onClick={resetFilters}>
              <X aria-hidden="true" className="size-4" strokeWidth={2} />
              Réinitialiser
            </Button>
          ) : null}
        </div>
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Aucun verbe ne correspond"
          description="Aucun verbe du dataset ne satisfait cette combinaison de filtres. Élargis la recherche ou repars de zéro."
          action={
            <Button size="sm" onClick={resetFilters}>
              Réinitialiser les filtres
            </Button>
          }
        />
      ) : (
        <>
          <div
            aria-hidden="true"
            className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto] gap-4 px-4 pb-2 text-2xs font-semibold tracking-wide text-muted uppercase md:grid"
          >
            <span>Base</span>
            <span>Prétérit</span>
            <span>Participe</span>
            <span>Traduction</span>
            <span className="sr-only">Actions</span>
          </div>

          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border">
            {results.map((verb) => (
              <VerbRow
                key={verb.id}
                verb={verb}
                mastered={isMastered(byVerb[verb.id])}
                favorite={favorites.includes(verb.id)}
                onToggleFavorite={() => toggleFavorite(verb.id)}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function VerbRow({
  verb,
  mastered,
  favorite,
  onToggleFavorite,
}: {
  verb: Verb;
  mastered: boolean;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <li className="bg-surface transition-colors duration-150 ease-out hover:bg-surface-2">
      <div className="flex items-center gap-2 px-2 py-1 md:px-3">
        <Link
          to={`/verbs/${verb.id}`}
          className="min-w-0 flex-1 rounded-[var(--radius-field)] px-2 py-3"
        >
          <div className="grid grid-cols-1 gap-x-4 gap-y-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)] md:items-baseline">
            <span lang="en" className="font-semibold">
              {verb.base}
            </span>
            <Cell label="Prétérit" lang="en">
              {formatVariants(verb.past)}
            </Cell>
            <Cell label="Participe" lang="en">
              {formatVariants(verb.participle)}
            </Cell>
            <Cell label="Traduction">{verb.fr.join(', ')}</Cell>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <PatternTag pattern={verb.pattern} />
            <TierTag tier={verb.tier} />
            {verb.huitoGroup ? <GroupChip group={verb.huitoGroup} /> : null}
            {verb.rank !== null ? (
              <span className="tnum text-2xs text-muted">n°{verb.rank}</span>
            ) : null}
            {mastered ? <MasteredBadge /> : null}
          </div>
        </Link>

        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={favorite}
          className={cx(
            'grid size-11 shrink-0 place-items-center rounded-[var(--radius-field)] transition-colors duration-150 ease-out',
            favorite ? 'text-accent-text' : 'text-muted hover:text-ink',
          )}
        >
          <Star
            aria-hidden="true"
            className="size-5"
            strokeWidth={1.75}
            fill={favorite ? 'currentColor' : 'none'}
          />
          <span className="sr-only">
            {favorite ? `Retirer ${verb.base} des favoris` : `Ajouter ${verb.base} aux favoris`}
          </span>
        </button>

        <ChevronRight
          aria-hidden="true"
          className="hidden size-4 shrink-0 text-muted md:block"
          strokeWidth={1.75}
        />
      </div>
    </li>
  );
}

function Cell({
  label,
  lang,
  children,
}: {
  label: string;
  lang?: string;
  children: React.ReactNode;
}) {
  return (
    <span className="flex min-w-0 items-baseline gap-2 text-sm">
      <span className="w-20 shrink-0 text-2xs text-muted md:hidden">{label}</span>
      <span lang={lang} className="min-w-0 truncate text-ink">
        {children}
      </span>
    </span>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">{label}</legend>
      <span aria-hidden="true" className="w-full text-2xs font-medium text-muted sm:w-auto">
        {label}
      </span>
      {children}
    </fieldset>
  );
}

function Chip({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={cx(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors duration-150 ease-out',
        active
          ? 'border-accent bg-accent-subtle text-accent-text'
          : 'border-border bg-surface text-muted hover:border-border-strong hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

function Count({ value }: { value: number }) {
  return <span className="tnum text-2xs opacity-70">{value}</span>;
}

function toggleIn<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
