import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { verbs } from '@/data/verbs';
import { generateSession } from '@/quiz/generate';
import { checkAnswer } from '@/quiz/check';
import { DEFAULT_CONFIG, type MatchingQuestion } from '@/quiz/types';
import { Matching } from './Matching';

function questionFor(verbIds: string[]): MatchingQuestion {
  const [question] = generateSession(
    {
      ...DEFAULT_CONFIG,
      seed: 7,
      modes: ['matching'],
      questionCount: 1,
      batchSize: verbIds.length as 4 | 6 | 8,
      scope: { kind: 'manual', verbIds },
      srsWeighting: false,
    },
    verbs,
    { byVerb: {}, favorites: [], mistakeVerbIds: [] },
  );
  if (!question || question.mode !== 'matching') throw new Error('question matching attendue');
  return question;
}

function assign(verb: string, role: 'Prétérit' | 'Participe', text: string): void {
  // Clic-clic : on sélectionne la carte du pool, puis son emplacement.
  const cards = screen.getAllByRole('button', { name: text });
  const card = cards.find((element) => element.getAttribute('draggable') === 'true');
  if (!card) throw new Error(`carte introuvable : ${text}`);
  fireEvent.click(card);

  fireEvent.click(
    screen.getByRole('button', { name: new RegExp(`Emplacement ${role} de ${verb}, vide`) }),
  );
}

describe('Matching — interaction clic-clic', () => {
  it('accepte les formes posées dans l’ordre inverse et complète la question', () => {
    const question = questionFor(['eat', 'buy', 'come', 'beat']);
    const onComplete = vi.fn();
    vi.useFakeTimers();
    render(<Matching question={question} disabled={false} onComplete={onComplete} />);

    // Participe avant prétérit pour chaque verbe.
    assign('eat', 'Participe', 'eaten');
    assign('eat', 'Prétérit', 'ate');
    assign('buy', 'Participe', 'bought');
    assign('buy', 'Prétérit', 'bought');
    assign('come', 'Participe', 'come');
    assign('come', 'Prétérit', 'came');
    assign('beat', 'Participe', 'beaten');
    assign('beat', 'Prétérit', 'beat');

    vi.runAllTimers();
    vi.useRealTimers();

    expect(onComplete).toHaveBeenCalledTimes(1);
    const assignment = onComplete.mock.calls[0]?.[0] as Parameters<typeof checkAnswer>[1];
    if (!assignment || !('past' in (Object.values(assignment)[0] ?? {}))) return;
    expect(
      checkAnswer(question, { kind: 'matching', assignment: assignment as never }).correct,
    ).toBe(true);
  });

  it('gère les triplets à formes identiques : deux cartes, deux emplacements', () => {
    const question = questionFor(['cut', 'put', 'set', 'let']);
    const onComplete = vi.fn();
    vi.useFakeTimers();
    render(<Matching question={question} disabled={false} onComplete={onComplete} />);

    // Deux cartes distinctes portent le même texte pour chaque verbe AAA.
    expect(screen.getAllByRole('button', { name: 'cut' })).toHaveLength(2);

    for (const verb of ['cut', 'put', 'set', 'let']) {
      assign(verb, 'Prétérit', verb);
      assign(verb, 'Participe', verb);
    }

    vi.runAllTimers();
    vi.useRealTimers();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('refuse une carte qui ne correspond pas et la laisse disponible', () => {
    const question = questionFor(['eat', 'buy', 'come', 'beat']);
    const onComplete = vi.fn();
    render(<Matching question={question} disabled={false} onComplete={onComplete} />);

    assign('eat', 'Prétérit', 'bought');

    // L'emplacement reste vide et la carte est toujours dans le pool.
    expect(
      screen.getByRole('button', { name: /Emplacement Prétérit de eat, vide/ }),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('button', { name: 'bought' })
        .some((element) => element.getAttribute('draggable') === 'true'),
    ).toBe(true);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('supporte le glisser-déposer en plus du clic-clic', () => {
    const question = questionFor(['eat', 'buy', 'come', 'beat']);
    render(<Matching question={question} disabled={false} onComplete={vi.fn()} />);

    const card = screen
      .getAllByRole('button', { name: 'ate' })
      .find((element) => element.getAttribute('draggable') === 'true');
    expect(card).toBeDefined();
    if (!card) return;

    const slot = screen.getByRole('button', { name: /Emplacement Prétérit de eat, vide/ });
    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (key: string, value: string) => data.set(key, value),
      getData: (key: string) => data.get(key) ?? '',
    };

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(slot, { dataTransfer });
    fireEvent.drop(slot, { dataTransfer });

    expect(
      screen.queryByRole('button', { name: /Emplacement Prétérit de eat, vide/ }),
    ).toBeNull();
  });
});
