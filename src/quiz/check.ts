import type { Pattern, VerbForm } from '@/data/schema';
import type {
  AnswerKind,
  CheckResult,
  MatchingCard,
  MatchingQuestion,
  Question,
} from './types';
import { formatVariants } from '@/lib/format';

/**
 * Correcteur pur. Aucune dépendance au store, aucune horloge :
 * `checkAnswer(question, input)` doit être rejouable à l'identique.
 */

/** Casse ignorée, espaces normalisés, « to » initial toléré, accents FR ignorés. */
export function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^to /, '');
}

/** Distance de Levenshtein, plafonnée : au-delà de `max` on renvoie `max + 1`. */
export function levenshtein(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }

  return previous[b.length] ?? max + 1;
}

export interface FieldVerdict {
  kind: AnswerKind;
  correct: boolean;
}

/**
 * Une saisie est correcte si elle correspond à **n'importe quelle** variante
 * acceptée (`burnt`/`burned`, `got`/`gotten`). Une distance de 1 est signalée
 * comme « presque — orthographe » mais reste comptée fausse (§6.3).
 */
export function verdictFor(input: string, accepted: readonly string[]): FieldVerdict {
  const value = normalizeAnswer(input);
  if (value === '') return { kind: 'skipped', correct: false };

  const targets = accepted.map(normalizeAnswer);
  if (targets.includes(value)) return { kind: 'correct', correct: true };

  const near = targets.some((target) => levenshtein(value, target, 1) <= 1);
  return near ? { kind: 'near-spelling', correct: false } : { kind: 'wrong', correct: false };
}

/** Affectation courante en mode Association : emplacement → carte posée. */
export type MatchingAssignment = Record<string, { past: string | null; participle: string | null }>;

export type AnswerInput =
  | { kind: 'choice'; value: string }
  | { kind: 'fields'; values: Partial<Record<VerbForm, string>> }
  /**
   * `mistakes` : verbes ayant reçu au moins une carte erronée avant d'être
   * complétés. L'interface n'accepte que les poses valides, donc sans cette
   * remontée la précision du mode Association serait toujours de 100 %.
   */
  | { kind: 'matching'; assignment: MatchingAssignment; mistakes?: string[] }
  | { kind: 'sort'; assignment: Record<string, Pattern | null> }
  | { kind: 'selfRating'; value: 'again' | 'good' | 'easy' }
  | { kind: 'timeout' };

/**
 * Une carte est acceptable dans un emplacement dès que son texte correspond à
 * une variante de la forme visée. L'ordre de pose est libre : poser le participe
 * avant le prétérit est aussi valide que l'inverse (§6.1).
 */
export function isCardValidForSlot(
  question: MatchingQuestion,
  verbId: string,
  role: 'past' | 'participle',
  card: MatchingCard,
): boolean {
  const slot = question.slots.find((candidate) => candidate.verbId === verbId);
  if (!slot) return false;
  const accepted = role === 'past' ? slot.past : slot.participle;
  return accepted.map(normalizeAnswer).includes(normalizeAnswer(card.text));
}

function matchingExpected(question: MatchingQuestion): string {
  return question.slots
    .map(
      (slot) =>
        `${slot.base} · ${formatVariants(slot.past)} · ${formatVariants(slot.participle)}`,
    )
    .join('\n');
}

export interface CheckOptions {
  /** `note` du verbe concerné, injectée par l'appelant (le correcteur reste pur). */
  note?: string | null;
  /** Notes par verbe pour les modes par lot. */
  notesByVerb?: Record<string, string | null>;
}

export function checkAnswer(
  question: Question,
  input: AnswerInput,
  options: CheckOptions = {},
): CheckResult {
  const note = options.note ?? null;

  if (input.kind === 'timeout') {
    return {
      correct: false,
      kind: 'timeout',
      expected: expectedOf(question),
      note,
    };
  }

  switch (question.mode) {
    case 'matching': {
      if (input.kind !== 'matching') break;
      const missed: string[] = [...new Set(input.mistakes ?? [])];
      for (const slot of question.slots) {
        if (missed.includes(slot.verbId)) continue;
        const assignment = input.assignment[slot.verbId];
        const pastCard = question.cards.find((card) => card.uid === assignment?.past);
        const participleCard = question.cards.find(
          (card) => card.uid === assignment?.participle,
        );
        const ok =
          pastCard !== undefined &&
          participleCard !== undefined &&
          isCardValidForSlot(question, slot.verbId, 'past', pastCard) &&
          isCardValidForSlot(question, slot.verbId, 'participle', participleCard);
        if (!ok) missed.push(slot.verbId);
      }

      const notes = options.notesByVerb ?? {};
      const missedNotes = missed
        .map((verbId) => notes[verbId])
        .filter((value): value is string => typeof value === 'string' && value.length > 0);

      return {
        correct: missed.length === 0,
        kind: missed.length === 0 ? 'correct' : missed.length < question.slots.length ? 'partial' : 'wrong',
        expected: matchingExpected(question),
        note: missedNotes.length > 0 ? missedNotes.join('\n') : null,
      };
    }

    case 'patternSort': {
      if (input.kind !== 'sort') break;
      const wrong = question.items.filter(
        (item) => input.assignment[item.verbId] !== item.pattern,
      );
      return {
        correct: wrong.length === 0,
        kind:
          wrong.length === 0
            ? 'correct'
            : wrong.length < question.items.length
              ? 'partial'
              : 'wrong',
        expected: question.items
          .map((item) => `${item.base} → ${item.pattern}`)
          .join('\n'),
        note: null,
      };
    }

    case 'flashcard': {
      if (input.kind !== 'selfRating') break;
      // Auto-évaluation : « Encore » compte comme une erreur pour le SRS.
      return {
        correct: input.value !== 'again',
        kind: input.value === 'again' ? 'wrong' : 'correct',
        expected: `${question.base} · ${formatVariants(question.past)} · ${formatVariants(question.participle)}`,
        note,
      };
    }

    default: {
      if (input.kind === 'choice') {
        const question_ = question as Extract<Question, { choices: string[] }>;
        const verdict = verdictFor(input.value, question_.accepted);
        return {
          correct: verdict.correct,
          kind: verdict.kind,
          expected: formatVariants(question_.accepted),
          note: verdict.correct ? null : note,
        };
      }

      if (input.kind === 'fields') {
        const question_ = question as Extract<Question, { fields: unknown }>;
        const perField = question_.fields.map((field) => {
          const verdict = verdictFor(input.values[field.key] ?? '', field.accepted);
          return {
            key: field.key,
            correct: verdict.correct,
            kind: verdict.kind,
            expected: formatVariants(field.accepted),
          };
        });

        const correct = perField.every((field) => field.correct);
        const anyNear = perField.some((field) => field.kind === 'near-spelling');
        const anyCorrect = perField.some((field) => field.correct);

        return {
          correct,
          kind: correct
            ? 'correct'
            : anyNear
              ? 'near-spelling'
              : anyCorrect
                ? 'partial'
                : 'wrong',
          expected: perField.map((field) => field.expected).join(' · '),
          note: correct ? null : note,
          perField,
        };
      }
    }
  }

  return { correct: false, kind: 'wrong', expected: expectedOf(question), note };
}

function expectedOf(question: Question): string {
  switch (question.mode) {
    case 'matching':
      return matchingExpected(question);
    case 'patternSort':
      return question.items.map((item) => `${item.base} → ${item.pattern}`).join('\n');
    case 'flashcard':
      return `${formatVariants(question.past)} · ${formatVariants(question.participle)}`;
    default:
      if ('accepted' in question) return formatVariants(question.accepted);
      if ('fields' in question)
        return question.fields.map((field) => formatVariants(field.accepted)).join(' · ');
      return '';
  }
}
