import type { Verb, VerbForm } from '@/data/schema';
import { buildDistractors } from './distractors';
import { createRng, type Rng } from './rng';
import type {
  Direction,
  FlashcardQuestion,
  InputQuestion,
  MatchingCard,
  MatchingQuestion,
  McqQuestion,
  PatternSortQuestion,
  ProgressSnapshot,
  Question,
  QuizConfig,
  QuizMode,
} from './types';

/** Modes qui consomment un lot de verbes par question. */
const BATCH_MODES: ReadonlySet<QuizMode> = new Set(['matching', 'patternSort']);

const FORM_LABEL: Record<VerbForm, string> = {
  base: 'Base verbale',
  past: 'Prétérit',
  participle: 'Participe passé',
};

/** Verbes du périmètre demandé, avant pondération et tirage. */
export function resolveScope(
  config: QuizConfig,
  verbs: Verb[],
  progress: ProgressSnapshot,
): Verb[] {
  const scope = config.scope;
  switch (scope.kind) {
    case 'all':
      return verbs;
    case 'tier':
      return scope.tiers.length === 0
        ? verbs
        : verbs.filter((verb) => scope.tiers.includes(verb.tier));
    case 'pattern':
      return scope.patterns.length === 0
        ? verbs
        : verbs.filter((verb) => scope.patterns.includes(verb.pattern));
    case 'group':
      return scope.groups.length === 0
        ? verbs
        : verbs.filter(
            (verb) => verb.huitoGroup !== null && scope.groups.includes(verb.huitoGroup),
          );
    case 'favorites': {
      const set = new Set(progress.favorites);
      return verbs.filter((verb) => set.has(verb.id));
    }
    case 'mistakes': {
      const set = new Set(progress.mistakeVerbIds);
      return verbs.filter((verb) => set.has(verb.id));
    }
    case 'manual': {
      const set = new Set(scope.verbIds);
      return verbs.filter((verb) => set.has(verb.id));
    }
  }
}

/** Nombre de verbes distincts nécessaires pour honorer la configuration. */
export function requiredVerbCount(config: QuizConfig): number {
  const batched = config.modes.some((mode) => BATCH_MODES.has(mode));
  const perQuestion = batched && config.modes.length === 1 ? config.batchSize : 1;
  return config.questionCount * perQuestion;
}

/**
 * Poids SRS : un verbe faible, jamais vu ou dû revient plus souvent.
 * Poids toujours ≥ 1 pour qu'aucun verbe du périmètre ne soit inatteignable.
 */
function srsWeight(verb: Verb, progress: ProgressSnapshot, now: number): number {
  const entry = progress.byVerb[verb.id];
  if (!entry || entry.attempts === 0) return 6;

  const accuracy = entry.correct / entry.attempts;
  const boxWeight = 6 - Math.min(5, entry.box); // boîte 1 → 5, boîte 5 → 1
  const accuracyWeight = 1 + (1 - accuracy) * 4;
  const overdue =
    entry.lastSeen === null ? 1 : now - entry.lastSeen > 24 * 60 * 60 * 1000 ? 1.5 : 1;

  return Math.max(1, boxWeight * accuracyWeight * overdue);
}

function weightedOrder(
  verbs: Verb[],
  progress: ProgressSnapshot,
  rng: Rng,
  now: number,
): Verb[] {
  // Tirage sans remise pondéré : on trie sur une clé aléatoire élevée à 1/poids.
  return [...verbs]
    .map((verb) => ({
      verb,
      key: Math.pow(rng.next(), 1 / srsWeight(verb, progress, now)),
    }))
    .sort((a, b) => b.key - a.key)
    .map((entry) => entry.verb);
}

/** Suite de verbes de la longueur demandée, avec ou sans répétition. */
function drawVerbs(
  pool: Verb[],
  needed: number,
  config: QuizConfig,
  progress: ProgressSnapshot,
  rng: Rng,
  now: number,
): Verb[] {
  if (pool.length === 0) return [];

  const ordered = config.srsWeighting
    ? weightedOrder(pool, progress, rng, now)
    : config.shuffle
      ? rng.shuffle(pool)
      : [...pool];

  if (ordered.length >= needed) return ordered.slice(0, needed);
  if (!config.allowRepeats) return ordered;

  // Périmètre trop petit et répétition autorisée : on boucle sur des passes
  // re-mélangées plutôt que de répéter la même séquence.
  const result = [...ordered];
  while (result.length < needed) {
    const extra = config.srsWeighting
      ? weightedOrder(pool, progress, rng, now)
      : rng.shuffle(pool);
    result.push(...extra.slice(0, needed - result.length));
  }
  return result;
}

function pickDirection(direction: Direction, rng: Rng): Exclude<Direction, 'mixed'> {
  if (direction !== 'mixed') return direction;
  const options: Exclude<Direction, 'mixed'>[] = ['en-en', 'fr-en', 'en-fr'];
  return options[rng.int(options.length)] ?? 'en-en';
}

function formsOf(verb: Verb, form: VerbForm): string[] {
  if (form === 'base') return [verb.base];
  return form === 'past' ? verb.past : verb.participle;
}

function buildMatching(
  batch: Verb[],
  pool: Verb[],
  config: QuizConfig,
  rng: Rng,
  index: number,
): MatchingQuestion {
  const cards: MatchingCard[] = [];

  for (const verb of batch) {
    // Formes identiques (`cut`/`cut`) : deux cartes distinctes, un uid chacune,
    // chacune assignable à son propre emplacement. C'est le piège du §6.1.
    const past = verb.past[0] ?? verb.base;
    const participle = verb.participle[0] ?? verb.base;
    cards.push({ uid: `${verb.id}__past`, text: past, verbId: verb.id, role: 'past' });
    cards.push({
      uid: `${verb.id}__participle`,
      text: participle,
      verbId: verb.id,
      role: 'participle',
    });
  }

  if (config.difficulty === 'expert') {
    // Variante Expert : distracteurs pris hors lot, dans le même pattern.
    const batchIds = new Set(batch.map((verb) => verb.id));
    const firstPattern = batch[0]?.pattern;
    const candidates = rng.shuffle(
      pool.filter((verb) => !batchIds.has(verb.id) && verb.pattern === firstPattern),
    );
    candidates.slice(0, 2).forEach((verb, offset) => {
      cards.push({
        uid: `distractor-${index}-${offset}`,
        text: verb.past[0] ?? verb.base,
        verbId: null,
        role: 'past',
      });
    });
  }

  return {
    id: `q${index}-matching`,
    mode: 'matching',
    verbIds: batch.map((verb) => verb.id),
    slots: batch.map((verb) => ({
      verbId: verb.id,
      base: verb.base,
      past: [...verb.past],
      participle: [...verb.participle],
      fr: [...verb.fr],
    })),
    cards: rng.shuffle(cards),
  };
}

function buildMcq(
  verb: Verb,
  pool: Verb[],
  config: QuizConfig,
  rng: Rng,
  index: number,
  mode: 'mcq' | 'speed',
): McqQuestion {
  const direction = pickDirection(config.direction, rng);
  const choiceCount = config.difficulty === 'easy' ? 4 : 4;

  if (direction === 'en-fr') {
    const accepted = [...verb.fr];
    const distractors = rng
      .shuffle(pool.filter((other) => other.id !== verb.id))
      .slice(0, choiceCount - 1)
      .map((other) => other.fr[0] ?? other.base);
    return {
      id: `q${index}-${mode}`,
      mode,
      verbIds: [verb.id],
      prompt: `Que signifie « to ${verb.base} » ?`,
      promptLang: 'fr',
      choices: rng.shuffle([accepted[0] ?? verb.base, ...distractors]),
      accepted,
      choicesLang: 'fr',
    };
  }

  if (direction === 'fr-en') {
    const accepted = [verb.base];
    const distractors = buildDistractors({
      verb,
      form: 'base',
      accepted,
      pool,
      count: choiceCount - 1,
      rng,
    });
    return {
      id: `q${index}-${mode}`,
      mode,
      verbIds: [verb.id],
      prompt: `Quel verbe anglais signifie « ${verb.fr[0] ?? ''} » ?`,
      promptLang: 'fr',
      choices: rng.shuffle([verb.base, ...distractors]),
      accepted,
      choicesLang: 'en',
    };
  }

  const form: VerbForm = rng.next() < 0.5 ? 'past' : 'participle';
  const accepted = formsOf(verb, form);
  const distractors = buildDistractors({
    verb,
    form,
    accepted,
    pool,
    count: choiceCount - 1,
    rng,
  });

  return {
    id: `q${index}-${mode}`,
    mode,
    verbIds: [verb.id],
    prompt:
      form === 'past'
        ? `Prétérit de « to ${verb.base} » ?`
        : `Participe passé de « to ${verb.base} » ?`,
    promptLang: 'fr',
    choices: rng.shuffle([accepted[0] ?? verb.base, ...distractors]),
    accepted,
    choicesLang: 'en',
  };
}

function buildFree(verb: Verb, index: number): InputQuestion {
  return {
    id: `q${index}-free`,
    mode: 'free',
    verbIds: [verb.id],
    prompt: verb.base,
    promptLang: 'en',
    fields: [
      { key: 'past', label: FORM_LABEL.past, accepted: [...verb.past] },
      { key: 'participle', label: FORM_LABEL.participle, accepted: [...verb.participle] },
    ],
  };
}

function buildTriplet(verb: Verb, rng: Rng, index: number): InputQuestion {
  const forms: VerbForm[] = ['base', 'past', 'participle'];
  const given = forms[rng.int(forms.length)] ?? 'base';
  const asked = forms.filter((form) => form !== given);

  return {
    id: `q${index}-triplet`,
    mode: 'triplet',
    verbIds: [verb.id],
    prompt: formsOf(verb, given)[0] ?? verb.base,
    promptLang: 'en',
    fields: asked.map((form) => ({
      key: form,
      label: FORM_LABEL[form],
      accepted: formsOf(verb, form),
    })),
  };
}

function buildTranslation(
  verb: Verb,
  pool: Verb[],
  config: QuizConfig,
  rng: Rng,
  index: number,
): McqQuestion | InputQuestion {
  const toFrench = pickDirection(config.direction, rng) === 'en-fr';

  if (config.difficulty === 'expert' && !toFrench) {
    return {
      id: `q${index}-translation`,
      mode: 'translation',
      verbIds: [verb.id],
      prompt: verb.fr[0] ?? '',
      promptLang: 'fr',
      fields: [{ key: 'base', label: 'Verbe anglais', accepted: [verb.base] }],
    };
  }

  if (toFrench) {
    const distractors = rng
      .shuffle(pool.filter((other) => other.id !== verb.id))
      .slice(0, 3)
      .map((other) => other.fr[0] ?? other.base);
    return {
      id: `q${index}-translation`,
      mode: 'translation',
      verbIds: [verb.id],
      prompt: `« to ${verb.base} » se traduit par…`,
      promptLang: 'fr',
      choices: rng.shuffle([verb.fr[0] ?? verb.base, ...distractors]),
      accepted: [...verb.fr],
      choicesLang: 'fr',
    };
  }

  const distractors = buildDistractors({
    verb,
    form: 'base',
    accepted: [verb.base],
    pool,
    count: 3,
    rng,
  });
  return {
    id: `q${index}-translation`,
    mode: 'translation',
    verbIds: [verb.id],
    prompt: `« ${verb.fr[0] ?? ''} » se dit…`,
    promptLang: 'fr',
    choices: rng.shuffle([verb.base, ...distractors]),
    accepted: [verb.base],
    choicesLang: 'en',
  };
}

function buildDictation(
  verb: Verb,
  pool: Verb[],
  config: QuizConfig,
  rng: Rng,
  index: number,
): McqQuestion | InputQuestion {
  const form: VerbForm = rng.next() < 0.5 ? 'past' : 'participle';
  const spoken = formsOf(verb, form)[0] ?? verb.base;

  if (config.difficulty === 'expert') {
    return {
      id: `q${index}-dictation`,
      mode: 'dictation',
      verbIds: [verb.id],
      prompt: 'Écoute puis écris la forme entendue.',
      promptLang: 'fr',
      spoken,
      fields: [{ key: form, label: FORM_LABEL[form], accepted: formsOf(verb, form) }],
    };
  }

  const distractors = buildDistractors({
    verb,
    form,
    accepted: formsOf(verb, form),
    pool,
    count: 3,
    rng,
  });
  return {
    id: `q${index}-dictation`,
    mode: 'dictation',
    verbIds: [verb.id],
    prompt: 'Quelle forme entends-tu ?',
    promptLang: 'fr',
    spoken,
    choices: rng.shuffle([spoken, ...distractors]),
    accepted: formsOf(verb, form),
    choicesLang: 'en',
  };
}

function buildFlashcard(verb: Verb, index: number): FlashcardQuestion {
  return {
    id: `q${index}-flashcard`,
    mode: 'flashcard',
    verbIds: [verb.id],
    base: verb.base,
    past: [...verb.past],
    participle: [...verb.participle],
    fr: [...verb.fr],
  };
}

function buildPatternSort(batch: Verb[], index: number): PatternSortQuestion {
  return {
    id: `q${index}-patternSort`,
    mode: 'patternSort',
    verbIds: batch.map((verb) => verb.id),
    items: batch.map((verb) => ({
      verbId: verb.id,
      base: verb.base,
      past: verb.past[0] ?? verb.base,
      participle: verb.participle[0] ?? verb.base,
      pattern: verb.pattern,
    })),
  };
}

/**
 * Générateur pur : mêmes entrées ⇒ même sortie. Aucun effet de bord,
 * aucune lecture d'horloge en dehors du paramètre `now`.
 * Renvoie un tableau vide si le périmètre est vide — l'appelant décide quoi afficher.
 */
export function generateSession(
  config: QuizConfig,
  verbs: Verb[],
  progress: ProgressSnapshot,
  now = Date.now(),
): Question[] {
  const pool = resolveScope(config, verbs, progress);
  if (pool.length === 0 || config.questionCount <= 0) return [];

  const modes = config.modes.length > 0 ? config.modes : (['mcq'] as QuizMode[]);
  const rng = createRng(config.seed);

  // Séquence de modes : un seul mode ⇒ constant, plusieurs ⇒ alternance aléatoire.
  const modeSequence: QuizMode[] = Array.from({ length: config.questionCount }, () =>
    modes.length === 1 ? (modes[0] as QuizMode) : (rng.pick(modes) ?? 'mcq'),
  );

  const needed = modeSequence.reduce(
    (sum, mode) => sum + (BATCH_MODES.has(mode) ? config.batchSize : 1),
    0,
  );
  const draw = drawVerbs(pool, needed, config, progress, rng, now);
  if (draw.length === 0) return [];

  const questions: Question[] = [];
  let cursor = 0;

  // Aucun bouclage implicite : si le tirage est épuisé, la session est plus
  // courte que demandé. La répétition n'a lieu que si elle a été autorisée,
  // auquel cas `drawVerbs` a déjà produit la longueur nécessaire.
  const take = (count: number): Verb[] => {
    const slice: Verb[] = [];
    for (let i = 0; i < count && cursor < draw.length; i += 1) {
      const verb = draw[cursor];
      cursor += 1;
      if (verb) slice.push(verb);
    }
    return slice;
  };

  for (const [index, mode] of modeSequence.entries()) {
    if (BATCH_MODES.has(mode)) {
      // Un lot ne peut pas dépasser le nombre de verbes réellement disponibles.
      const size = Math.min(config.batchSize, config.allowRepeats ? config.batchSize : pool.length);
      const batch = take(size);
      if (batch.length === 0) break;
      questions.push(
        mode === 'matching'
          ? buildMatching(batch, pool, config, rng, index)
          : buildPatternSort(batch, index),
      );
      continue;
    }

    const verb = take(1)[0];
    if (!verb) break;

    switch (mode) {
      case 'mcq':
      case 'speed':
        questions.push(buildMcq(verb, pool, config, rng, index, mode));
        break;
      case 'free':
        questions.push(buildFree(verb, index));
        break;
      case 'triplet':
        questions.push(buildTriplet(verb, rng, index));
        break;
      case 'translation':
        questions.push(buildTranslation(verb, pool, config, rng, index));
        break;
      case 'dictation':
        questions.push(buildDictation(verb, pool, config, rng, index));
        break;
      case 'flashcard':
        questions.push(buildFlashcard(verb, index));
        break;
      default:
        questions.push(buildMcq(verb, pool, config, rng, index, 'mcq'));
    }
  }

  return questions;
}
