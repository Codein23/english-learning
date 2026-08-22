import { describe, expect, it } from 'vitest';
import { verbs, getVerb } from '@/data/verbs';
import { generateSession } from './generate';
import { checkAnswer } from './check';
import { DEFAULT_CONFIG, type MatchingQuestion } from './types';

function question(verbIds: string[]): MatchingQuestion {
  const [first] = generateSession(
    {
      ...DEFAULT_CONFIG,
      seed: 3,
      modes: ['matching'],
      questionCount: 1,
      batchSize: verbIds.length as 4 | 6 | 8,
      scope: { kind: 'manual', verbIds },
      srsWeighting: false,
    },
    verbs,
    { byVerb: {}, favorites: [], mistakeVerbIds: [] },
  );
  if (!first || first.mode !== 'matching') throw new Error('question matching attendue');
  return first;
}

function fullAssignment(matching: MatchingQuestion) {
  return Object.fromEntries(
    matching.slots.map((slot) => {
      const cards = matching.cards.filter((card) => card.verbId === slot.verbId);
      const past = cards.find((card) => card.role === 'past')?.uid ?? null;
      const participle = cards.find((card) => card.role === 'participle')?.uid ?? null;
      return [slot.verbId, { past, participle }];
    }),
  );
}

describe('Association — les mauvaises poses comptent', () => {
  const ids = ['eat', 'buy', 'come', 'beat'];

  it('reste correct quand aucune erreur n’a été commise', () => {
    const matching = question(ids);
    const result = checkAnswer(matching, {
      kind: 'matching',
      assignment: fullAssignment(matching),
      mistakes: [],
    });
    expect(result.correct).toBe(true);
  });

  it('compte le verbe comme raté après une carte erronée, même une fois complété', () => {
    const matching = question(ids);
    const result = checkAnswer(
      matching,
      { kind: 'matching', assignment: fullAssignment(matching), mistakes: ['eat'] },
      { notesByVerb: { eat: getVerb('eat')?.note ?? null } },
    );
    expect(result.correct).toBe(false);
    expect(result.kind).toBe('partial');
  });

  it('remonte la note pédagogique des verbes ratés', () => {
    const matching = question(['read', 'lie', 'hang', 'shine']);
    const note = getVerb('read')?.note ?? null;
    const result = checkAnswer(
      matching,
      { kind: 'matching', assignment: fullAssignment(matching), mistakes: ['read'] },
      { notesByVerb: { read: note } },
    );
    expect(result.note).toBe(note);
    expect(result.note).not.toBeNull();
  });
});
