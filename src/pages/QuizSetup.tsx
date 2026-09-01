import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Play } from 'lucide-react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Button } from '@/components/ui/Button';
import { Field, Option, Switch } from '@/components/quiz/SetupControls';
import { GroupChip } from '@/components/ui/Tags';
import { HUITO_GROUPS, PATTERNS, type HuitoGroup } from '@/data/schema';
import { getVerb, verbs } from '@/data/verbs';
import { GROUP_META, PATTERN_EXAMPLE, TIER_LABEL } from '@/lib/groups';
import { formatCount } from '@/lib/format';
import { useAudio } from '@/lib/useAudio';
import { useProgress } from '@/store/progress';
import { useLastConfig, useSession } from '@/store/session';
import { requiredVerbCount, resolveScope } from '@/quiz/generate';
import {
  DEFAULT_CONFIG,
  MODE_DESCRIPTION,
  MODE_LABEL,
  QUIZ_MODES,
  type Difficulty,
  type Direction,
  type QuizConfig,
  type QuizMode,
  type ScopeKind,
} from '@/quiz/types';
import { PRESETS } from '@/quiz/types';

const COUNT_OPTIONS = [5, 10, 15, 25, 50, 100] as const;
const PER_QUESTION_OPTIONS = [null, 5, 10, 15, 30, 60] as const;
const SESSION_OPTIONS = [null, 120, 300, 600] as const;

const DIRECTION_LABEL: Record<Direction, string> = {
  'en-en': 'EN → EN',
  'fr-en': 'FR → EN',
  'en-fr': 'EN → FR',
  mixed: 'Mixte',
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Facile',
  normal: 'Normal',
  expert: 'Expert',
};

const DIFFICULTY_HINT: Record<Difficulty, string> = {
  easy: '4 choix, indices disponibles',
  normal: 'Équilibré',
  expert: 'Saisie libre, orthographe stricte, sans indice',
};

type ScopeChoice = ScopeKind['kind'];

export function QuizSetupPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const stored = useLastConfig((state) => state.config);
  const start = useSession((state) => state.start);
  const audio = useAudio();

  const favorites = useProgress((state) => state.favorites);
  const sessions = useProgress((state) => state.sessions);

  const mistakeIds = useMemo(() => {
    const set = new Set<string>();
    for (const session of sessions) for (const id of session.missedVerbIds) set.add(id);
    return [...set];
  }, [sessions]);

  // Deep-link « s'entraîner sur ce verbe » depuis une fiche verbe : appliqué à
  // l'initialisation, pas dans un effet, pour éviter un premier rendu périmé.
  const [config, setConfig] = useState<QuizConfig>(() => {
    const base = { ...DEFAULT_CONFIG, ...stored };
    const requested = params.get('verbs');
    if (!requested) return base;
    const ids = requested.split(',').filter((id) => getVerb(id) !== undefined);
    if (ids.length === 0) return base;
    return {
      ...base,
      scope: { kind: 'manual', verbIds: ids },
      questionCount: Math.max(5, Math.min(base.questionCount, ids.length * 3)),
      allowRepeats: ids.length < 5,
    };
  });
  const [customCount, setCustomCount] = useState(config.questionCount);
  const [error, setError] = useState<string | null>(null);

  const patch = (values: Partial<QuizConfig>) => setConfig((current) => ({ ...current, ...values }));

  const progressSnapshot = useMemo(
    () => ({ byVerb: {}, favorites, mistakeVerbIds: mistakeIds }),
    [favorites, mistakeIds],
  );

  const pool = useMemo(
    () => resolveScope(config, verbs, progressSnapshot),
    [config, progressSnapshot],
  );
  const needed = requiredVerbCount(config);
  const shortfall = pool.length > 0 && pool.length < needed;

  const toggleMode = (mode: QuizMode) => {
    setConfig((current) => {
      const active = current.modes.includes(mode);
      const modes = active
        ? current.modes.filter((value) => value !== mode)
        : [...current.modes, mode];
      // Au moins un mode : on refuse de vider la sélection.
      return { ...current, modes: modes.length === 0 ? current.modes : modes };
    });
  };

  const setScope = (kind: ScopeChoice) => {
    const next: Record<ScopeChoice, ScopeKind> = {
      all: { kind: 'all' },
      tier: { kind: 'tier', tiers: [1] },
      pattern: { kind: 'pattern', patterns: ['ABB'] },
      group: { kind: 'group', groups: ['GEMINI'] },
      favorites: { kind: 'favorites' },
      mistakes: { kind: 'mistakes' },
      manual: { kind: 'manual', verbIds: [] },
    };
    patch({ scope: next[kind] });
  };

  const launch = () => {
    if (pool.length === 0) {
      setError(
        'Ce périmètre ne contient aucun verbe. Choisis un autre périmètre avant de lancer.',
      );
      return;
    }
    const count = start(config);
    if (count === 0) {
      setError("La session n'a pas pu être générée. Élargis le périmètre.");
      return;
    }
    const firstQuestion = useSession.getState().questions[0];
    if (
      config.audioOnReveal &&
      audio.available &&
      firstQuestion &&
      firstQuestion.mode === 'dictation' &&
      firstQuestion.spoken
    ) {
      audio.speak(firstQuestion.spoken);
    }
    setError(null);
    void navigate('/quiz/run');
  };

  return (
    <div className="space-y-8">
      <PageTitle
        title="Paramétrer la session"
        description="Ces réglages sont enregistrés et rechargés à la prochaine ouverture."
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted">Préréglages</h2>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.id}
              size="sm"
              onClick={() => {
                patch(preset.patch);
                if (preset.patch.questionCount) setCustomCount(preset.patch.questionCount);
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </section>

      <Field
        label="Modes"
        hint="Plusieurs modes sélectionnés : alternance aléatoire dans la session."
      >
        {QUIZ_MODES.map((mode) => {
          const audioMode = mode === 'dictation';
          return (
            <Option
              key={mode}
              active={config.modes.includes(mode)}
              onClick={() => toggleMode(mode)}
              title={
                audioMode && !audio.available
                  ? 'Aucune source audio disponible sur cet appareil'
                  : MODE_DESCRIPTION[mode]
              }
              disabled={audioMode && !audio.available}
            >
              {MODE_LABEL[mode]}
            </Option>
          );
        })}
      </Field>

      <Field label="Nombre de questions">
        {COUNT_OPTIONS.map((count) => (
          <Option
            key={count}
            active={config.questionCount === count}
            onClick={() => patch({ questionCount: count })}
          >
            <span className="tnum">{count}</span>
          </Option>
        ))}
        <label className="flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm">
          <span className="text-muted">Personnalisé</span>
          <input
            type="range"
            min={1}
            max={200}
            value={customCount}
            onChange={(event) => {
              const value = Number(event.target.value);
              setCustomCount(value);
              patch({ questionCount: value });
            }}
            className="w-32 accent-[var(--color-accent)]"
            aria-label="Nombre de questions personnalisé"
          />
          <input
            type="number"
            min={1}
            max={500}
            value={config.questionCount}
            onChange={(event) => {
              const value = Math.max(1, Number(event.target.value) || 1);
              setCustomCount(value);
              patch({ questionCount: value });
            }}
            className="tnum w-16 rounded-[var(--radius-field)] border border-border bg-bg px-2 py-1 text-sm"
            aria-label="Nombre de questions"
          />
        </label>
      </Field>

      <Field
        label="Minuteur par question"
        hint="Dépassement du temps : la réponse est comptée fausse."
      >
        {PER_QUESTION_OPTIONS.map((seconds) => (
          <Option
            key={String(seconds)}
            active={config.perQuestionSeconds === seconds}
            onClick={() => patch({ perQuestionSeconds: seconds })}
          >
            {seconds === null ? 'Aucun' : <span className="tnum">{seconds} s</span>}
          </Option>
        ))}
      </Field>

      <Field label="Minuteur global">
        {SESSION_OPTIONS.map((seconds) => (
          <Option
            key={String(seconds)}
            active={config.sessionSeconds === seconds}
            onClick={() => patch({ sessionSeconds: seconds })}
          >
            {seconds === null ? 'Aucun' : <span className="tnum">{seconds / 60} min</span>}
          </Option>
        ))}
      </Field>

      <Field label="Périmètre">
        {(
          [
            ['all', 'Tous les verbes'],
            ['tier', 'Par fréquence'],
            ['pattern', 'Par schéma'],
            ['group', 'Par groupe Huito'],
            ['favorites', `Favoris (${formatCount(favorites.length)})`],
            ['mistakes', `Erreurs passées (${formatCount(mistakeIds.length)})`],
            ['manual', 'Sélection manuelle'],
          ] as [ScopeChoice, string][]
        ).map(([kind, label]) => (
          <Option key={kind} active={config.scope.kind === kind} onClick={() => setScope(kind)}>
            {label}
          </Option>
        ))}
      </Field>

      {config.scope.kind === 'tier' ? (
        <Field label="Niveaux de fréquence">
          {([1, 2, 3] as const).map((tier) => {
            const scope = config.scope as Extract<ScopeKind, { kind: 'tier' }>;
            const active = scope.tiers.includes(tier);
            return (
              <Option
                key={tier}
                active={active}
                title={TIER_LABEL[tier]}
                onClick={() =>
                  patch({
                    scope: {
                      kind: 'tier',
                      tiers: active
                        ? scope.tiers.filter((value) => value !== tier)
                        : [...scope.tiers, tier],
                    },
                  })
                }
              >
                {TIER_LABEL[tier]}
              </Option>
            );
          })}
        </Field>
      ) : null}

      {config.scope.kind === 'pattern' ? (
        <Field label="Schémas">
          {PATTERNS.map((pattern) => {
            const scope = config.scope as Extract<ScopeKind, { kind: 'pattern' }>;
            const active = scope.patterns.includes(pattern);
            return (
              <Option
                key={pattern}
                active={active}
                title={PATTERN_EXAMPLE[pattern]}
                onClick={() =>
                  patch({
                    scope: {
                      kind: 'pattern',
                      patterns: active
                        ? scope.patterns.filter((value) => value !== pattern)
                        : [...scope.patterns, pattern],
                    },
                  })
                }
              >
                <span className="font-mono tracking-wider">{pattern}</span>
              </Option>
            );
          })}
        </Field>
      ) : null}

      {config.scope.kind === 'group' ? (
        <Field label="Groupes Huito">
          {HUITO_GROUPS.map((group: HuitoGroup) => {
            const scope = config.scope as Extract<ScopeKind, { kind: 'group' }>;
            const active = scope.groups.includes(group);
            return (
              <Option
                key={group}
                active={active}
                title={GROUP_META[group].description}
                onClick={() =>
                  patch({
                    scope: {
                      kind: 'group',
                      groups: active
                        ? scope.groups.filter((value) => value !== group)
                        : [...scope.groups, group],
                    },
                  })
                }
              >
                <GroupChip group={group} />
              </Option>
            );
          })}
        </Field>
      ) : null}

      {config.scope.kind === 'manual' ? (
        <ManualScope
          verbIds={config.scope.verbIds}
          onChange={(verbIds) => patch({ scope: { kind: 'manual', verbIds } })}
        />
      ) : null}

      <Field label="Sens de l'interrogation">
        {(['en-en', 'fr-en', 'en-fr', 'mixed'] as Direction[]).map((direction) => (
          <Option
            key={direction}
            active={config.direction === direction}
            onClick={() => patch({ direction })}
          >
            {DIRECTION_LABEL[direction]}
          </Option>
        ))}
      </Field>

      <Field label="Difficulté">
        {(['easy', 'normal', 'expert'] as Difficulty[]).map((difficulty) => (
          <Option
            key={difficulty}
            active={config.difficulty === difficulty}
            title={DIFFICULTY_HINT[difficulty]}
            onClick={() => patch({ difficulty })}
          >
            {DIFFICULTY_LABEL[difficulty]}
          </Option>
        ))}
      </Field>

      {config.modes.includes('matching') || config.modes.includes('patternSort') ? (
        <Field label="Taille des lots" hint="Association et tri par schéma.">
          {([4, 6, 8] as const).map((size) => (
            <Option
              key={size}
              active={config.batchSize === size}
              onClick={() => patch({ batchSize: size })}
            >
              <span className="tnum">{size} verbes</span>
            </Option>
          ))}
        </Field>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Options</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Switch
            label="Audio à l'affichage"
            description="En dictée, lance l'audio dès l'affichage ; sinon, prononce la bonne forme à la correction."
            checked={config.audioOnReveal}
            onChange={(audioOnReveal) => patch({ audioOnReveal })}
          />
          <Switch
            label="Indice première lettre"
            description="Disponible en Facile et Normal. −25 points."
            checked={config.firstLetterHint}
            onChange={(firstLetterHint) => patch({ firstLetterHint })}
          />
          <Switch
            label="Correction immédiate"
            description="Sinon, tout est corrigé en fin de session."
            checked={config.immediateFeedback}
            onChange={(immediateFeedback) => patch({ immediateFeedback })}
          />
          <Switch
            label="Ordre aléatoire"
            checked={config.shuffle}
            onChange={(shuffle) => patch({ shuffle })}
          />
          <Switch
            label="Pondération SRS"
            description="Privilégie les verbes faibles et ceux à réviser."
            checked={config.srsWeighting}
            onChange={(srsWeighting) => patch({ srsWeighting })}
          />
        </div>
      </section>

      {shortfall ? (
        <div className="space-y-3 rounded-[var(--radius-card)] border border-warning/40 bg-warning-subtle px-4 py-4">
          <p className="flex items-start gap-2 text-sm text-warning-text">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
            Ce périmètre contient {formatCount(pool.length)} verbes, il en faudrait{' '}
            {formatCount(needed)} pour {formatCount(config.questionCount)} questions sans
            répétition.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={config.allowRepeats ? 'primary' : 'secondary'}
              onClick={() => patch({ allowRepeats: true })}
            >
              Autoriser la répétition
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const adjusted = Math.max(1, pool.length);
                setCustomCount(adjusted);
                patch({ questionCount: adjusted, allowRepeats: false });
              }}
            >
              Ajuster à {formatCount(pool.length)} questions
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-[var(--radius-card)] border border-danger/40 bg-danger-subtle px-4 py-3 text-sm text-danger-text">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[var(--z-sticky)] -mx-4 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:-mx-10 lg:px-10">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="lg" onClick={launch} disabled={pool.length === 0}>
            <Play aria-hidden="true" className="size-4" strokeWidth={2} />
            Lancer la session
          </Button>
          <p className="tnum text-sm text-muted">
            {formatCount(pool.length)} verbes dans le périmètre ·{' '}
            {formatCount(config.questionCount)} questions
          </p>
        </div>
      </div>
    </div>
  );
}

function ManualScope({
  verbIds,
  onChange,
}: {
  verbIds: string[];
  onChange: (verbIds: string[]) => void;
}) {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return [];
    return verbs
      .filter(
        (verb) =>
          !verbIds.includes(verb.id) &&
          (verb.base.startsWith(needle) || verb.fr.some((value) => value.includes(needle))),
      )
      .slice(0, 8);
  }, [query, verbIds]);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">Sélection manuelle</h2>

      <label className="block">
        <span className="sr-only">Ajouter un verbe à la sélection</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Chercher un verbe à ajouter…"
          className="h-11 w-full max-w-sm rounded-[var(--radius-field)] border border-border bg-surface px-3 text-base placeholder:text-muted hover:border-border-strong"
        />
      </label>

      {matches.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {matches.map((verb) => (
            <li key={verb.id}>
              <Button
                size="sm"
                onClick={() => {
                  onChange([...verbIds, verb.id]);
                  setQuery('');
                }}
              >
                <span lang="en">+ {verb.base}</span>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {verbIds.length === 0 ? (
        <p className="text-xs text-muted">
          Aucun verbe sélectionné : la session ne peut pas démarrer tant que cette liste est
          vide.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {verbIds.map((verbId) => (
            <li key={verbId}>
              <button
                type="button"
                onClick={() => onChange(verbIds.filter((value) => value !== verbId))}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-accent bg-accent-subtle px-3 text-sm text-accent-text"
              >
                <span lang="en">{getVerb(verbId)?.base ?? verbId}</span>
                <span aria-hidden="true">×</span>
                <span className="sr-only">Retirer de la sélection</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
