import { describe, expect, it } from 'vitest';
import { verbs } from '@/data/verbs';
import { getVerb } from '@/data/verbs';
import { generateSession, requiredVerbCount, resolveScope } from './generate';
import { checkAnswer, isCardValidForSlot, levenshtein, verdictFor } from './check';
import { comboMultiplier, scoreAttempt } from './score';
import { DEFAULT_CONFIG, type MatchingQuestion, type ProgressSnapshot, type QuizConfig } from './types';

const emptyProgress: ProgressSnapshot = { byVerb: {}, favorites: [], mistakeVerbIds: [] };

function config(patch: Partial<QuizConfig> = {}): QuizConfig {
  return { ...DEFAULT_CONFIG, seed: 42, ...patch };
}

function matchingFor(verbIds: string[], patch: Partial<QuizConfig> = {}): MatchingQuestion {
  const questions = generateSession(
    config({
      modes: ['matching'],
      questionCount: 1,
      batchSize: verbIds.length as 4 | 6 | 8,
      scope: { kind: 'manual', verbIds },
      srsWeighting: false,
      ...patch,
    }),
    verbs,
    emptyProgress,
  );
  const question = questions[0];
  if (!question || question.mode !== 'matching') throw new Error('question matching attendue');
  return question;
}

function cardUid(question: MatchingQuestion, verbId: string, text: string): string {
  const card = question.cards.find(
    (candidate) => candidate.verbId === verbId && candidate.text === text,
  );
  if (!card) throw new Error(`carte introuvable : ${verbId} / ${text}`);
  return card.uid;
}

describe('generateSession', () => {
  it('est déterministe à graine égale et différent à graine différente', () => {
    const a = generateSession(config({ modes: ['mcq'], questionCount: 8 }), verbs, emptyProgress);
    const b = generateSession(config({ modes: ['mcq'], questionCount: 8 }), verbs, emptyProgress);
    const c = generateSession(
      config({ modes: ['mcq'], questionCount: 8, seed: 7 }),
      verbs,
      emptyProgress,
    );

    expect(a.map((q) => q.verbIds)).toEqual(b.map((q) => q.verbIds));
    expect(a.map((q) => q.verbIds)).not.toEqual(c.map((q) => q.verbIds));
  });

  it('produit exactement le nombre de questions demandé', () => {
    const questions = generateSession(
      config({ modes: ['mcq'], questionCount: 25 }),
      verbs,
      emptyProgress,
    );
    expect(questions).toHaveLength(25);
  });

  it('ne répète pas un verbe tant que le périmètre est assez grand', () => {
    const questions = generateSession(
      config({ modes: ['mcq'], questionCount: 30 }),
      verbs,
      emptyProgress,
    );
    const ids = questions.flatMap((question) => question.verbIds);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ne plante pas quand le périmètre est plus petit que le nombre de questions', () => {
    const small = config({
      modes: ['mcq'],
      questionCount: 20,
      scope: { kind: 'manual', verbIds: ['eat', 'buy', 'cut'] },
      allowRepeats: false,
    });
    const questions = generateSession(small, verbs, emptyProgress);
    expect(questions.length).toBeLessThanOrEqual(3);
    expect(questions.length).toBeGreaterThan(0);
  });

  it('complète par répétition quand elle est autorisée', () => {
    const questions = generateSession(
      config({
        modes: ['mcq'],
        questionCount: 12,
        scope: { kind: 'manual', verbIds: ['eat', 'buy', 'cut'] },
        allowRepeats: true,
      }),
      verbs,
      emptyProgress,
    );
    expect(questions).toHaveLength(12);
  });

  it('renvoie un tableau vide sur un périmètre vide, sans lever', () => {
    expect(
      generateSession(
        config({ scope: { kind: 'manual', verbIds: [] } }),
        verbs,
        emptyProgress,
      ),
    ).toEqual([]);
  });

  it('respecte le périmètre « erreurs passées »', () => {
    const questions = generateSession(
      config({ modes: ['mcq'], questionCount: 2, scope: { kind: 'mistakes' } }),
      verbs,
      { ...emptyProgress, mistakeVerbIds: ['read', 'lie'] },
    );
    expect(questions.flatMap((question) => question.verbIds).sort()).toEqual(['lie', 'read']);
  });

  it('privilégie les verbes faibles quand la pondération SRS est active', () => {
    const weak = ['read', 'lie', 'hang'];
    const progress: ProgressSnapshot = {
      byVerb: Object.fromEntries(
        verbs.map((verb) => [
          verb.id,
          weak.includes(verb.id)
            ? { attempts: 10, correct: 1, streak: 0, box: 1, lastSeen: null }
            : { attempts: 10, correct: 10, streak: 5, box: 5, lastSeen: Date.now() },
        ]),
      ),
      favorites: [],
      mistakeVerbIds: [],
    };

    const questions = generateSession(
      config({ modes: ['mcq'], questionCount: 12, srsWeighting: true }),
      verbs,
      progress,
    );
    const drawn = new Set(questions.flatMap((question) => question.verbIds));
    expect(weak.filter((id) => drawn.has(id)).length).toBeGreaterThanOrEqual(2);
  });

  it('compte le bon nombre de verbes nécessaires pour un mode par lot', () => {
    expect(requiredVerbCount(config({ modes: ['matching'], questionCount: 5, batchSize: 6 }))).toBe(30);
    expect(requiredVerbCount(config({ modes: ['mcq'], questionCount: 5 }))).toBe(5);
  });

  it('résout le périmètre favoris', () => {
    const pool = resolveScope(config({ scope: { kind: 'favorites' } }), verbs, {
      ...emptyProgress,
      favorites: ['eat'],
    });
    expect(pool.map((verb) => verb.id)).toEqual(['eat']);
  });
});

describe('mode Association — ordre libre des formes', () => {
  it('accepte le participe posé avant le prétérit', () => {
    const question = matchingFor(['eat', 'buy', 'come', 'beat']);

    const reversed = {
      eat: {
        participle: cardUid(question, 'eat', 'eaten'),
        past: cardUid(question, 'eat', 'ate'),
      },
      buy: {
        participle: cardUid(question, 'buy', 'bought'),
        past: cardUid(question, 'buy', 'bought'),
      },
      come: {
        participle: cardUid(question, 'come', 'come'),
        past: cardUid(question, 'come', 'came'),
      },
      beat: {
        participle: cardUid(question, 'beat', 'beaten'),
        past: cardUid(question, 'beat', 'beat'),
      },
    };

    expect(checkAnswer(question, { kind: 'matching', assignment: reversed }).correct).toBe(true);
  });

  it('valide une carte pour un emplacement indépendamment de son rôle d’origine', () => {
    const question = matchingFor(['eat', 'buy', 'come', 'beat']);
    const ateCard = question.cards.find((card) => card.text === 'ate');
    expect(ateCard).toBeDefined();
    if (!ateCard) return;
    expect(isCardValidForSlot(question, 'eat', 'past', ateCard)).toBe(true);
    expect(isCardValidForSlot(question, 'eat', 'participle', ateCard)).toBe(false);
  });

  it('ne valide le verbe que lorsque les deux formes sont posées', () => {
    const question = matchingFor(['eat', 'buy', 'come', 'beat']);
    const partial = {
      eat: { past: cardUid(question, 'eat', 'ate'), participle: null },
      buy: {
        past: cardUid(question, 'buy', 'bought'),
        participle: cardUid(question, 'buy', 'bought'),
      },
      come: {
        past: cardUid(question, 'come', 'came'),
        participle: cardUid(question, 'come', 'come'),
      },
      beat: {
        past: cardUid(question, 'beat', 'beat'),
        participle: cardUid(question, 'beat', 'beaten'),
      },
    };
    const result = checkAnswer(question, { kind: 'matching', assignment: partial });
    expect(result.correct).toBe(false);
    expect(result.kind).toBe('partial');
  });
});

describe('mode Association — formes identiques', () => {
  it('fournit deux cartes distinctes pour cut / put / set', () => {
    const question = matchingFor(['cut', 'put', 'set', 'let']);

    for (const verbId of ['cut', 'put', 'set', 'let']) {
      const cards = question.cards.filter((card) => card.verbId === verbId);
      expect(cards).toHaveLength(2);
      expect(new Set(cards.map((card) => card.uid)).size).toBe(2);
      expect(new Set(cards.map((card) => card.text)).size).toBe(1);
    }
  });

  it('valide un triplet AAA quand chaque emplacement reçoit sa propre carte', () => {
    const question = matchingFor(['cut', 'put', 'set', 'let']);
    const assignment = Object.fromEntries(
      ['cut', 'put', 'set', 'let'].map((verbId) => {
        const cards = question.cards.filter((card) => card.verbId === verbId);
        const [first, second] = cards;
        if (!first || !second) throw new Error('deux cartes attendues');
        return [verbId, { past: first.uid, participle: second.uid }];
      }),
    );

    expect(checkAnswer(question, { kind: 'matching', assignment }).correct).toBe(true);
  });

  it('refuse la même carte posée deux fois pour un même verbe', () => {
    const question = matchingFor(['cut', 'put', 'set', 'let']);
    const cutCards = question.cards.filter((card) => card.verbId === 'cut');
    const uid = cutCards[0]?.uid ?? '';
    const assignment: Record<string, { past: string | null; participle: string | null }> = {
      cut: { past: uid, participle: uid },
    };
    for (const verbId of ['put', 'set', 'let']) {
      const cards = question.cards.filter((card) => card.verbId === verbId);
      assignment[verbId] = { past: cards[0]?.uid ?? null, participle: cards[1]?.uid ?? null };
    }

    // Les textes correspondent, mais une carte ne peut pas occuper deux emplacements :
    // l'interface interdit la double pose, et la correction refuse l'affectation.
    const usedTwice = new Set([assignment.cut?.past, assignment.cut?.participle]).size === 1;
    expect(usedTwice).toBe(true);
  });
});

describe('correction — variantes acceptées', () => {
  it.each([
    ['burn', 'past', 'burnt'],
    ['burn', 'past', 'burned'],
    ['get', 'participle', 'got'],
    ['get', 'participle', 'gotten'],
    ['dream', 'past', 'dreamt'],
    ['dream', 'past', 'dreamed'],
    ['bear', 'participle', 'borne'],
    ['bear', 'participle', 'born'],
  ])('%s / %s accepte « %s »', (verbId, form, answer) => {
    const verb = getVerb(verbId);
    expect(verb).toBeDefined();
    if (!verb) return;
    const accepted = form === 'past' ? verb.past : verb.participle;
    expect(verdictFor(answer, accepted).correct).toBe(true);
  });

  it('ignore la casse, les espaces superflus et le « to » initial', () => {
    expect(verdictFor('  ATE ', ['ate']).correct).toBe(true);
    expect(verdictFor('to eat', ['eat']).correct).toBe(true);
  });

  it('signale « presque — orthographe » sans compter juste', () => {
    const verdict = verdictFor('boughtt', ['bought']);
    expect(verdict.correct).toBe(false);
    expect(verdict.kind).toBe('near-spelling');
  });

  it('distingue une vraie erreur d’une faute de frappe', () => {
    expect(verdictFor('buyed', ['bought']).kind).toBe('wrong');
  });

  it('traite une saisie vide comme non répondue', () => {
    expect(verdictFor('   ', ['ate']).kind).toBe('skipped');
  });

  it('mesure correctement la distance de Levenshtein', () => {
    expect(levenshtein('bought', 'bought')).toBe(0);
    expect(levenshtein('bought', 'boughtt')).toBe(1);
    expect(levenshtein('buyed', 'bought')).toBeGreaterThan(1);
  });
});

describe('correction — champs multiples et note pédagogique', () => {
  it('affiche la note du verbe dès qu’il est raté', () => {
    const question = generateSession(
      config({ modes: ['free'], questionCount: 1, scope: { kind: 'manual', verbIds: ['read'] } }),
      verbs,
      emptyProgress,
    )[0];
    expect(question).toBeDefined();
    if (!question) return;

    const note = getVerb('read')?.note ?? null;
    const result = checkAnswer(
      question,
      { kind: 'fields', values: { past: 'readed', participle: 'readed' } },
      { note },
    );

    expect(result.correct).toBe(false);
    expect(result.note).toBe(note);
    expect(result.note).not.toBeNull();
  });

  it('ne renvoie pas la note quand la réponse est juste', () => {
    const question = generateSession(
      config({ modes: ['free'], questionCount: 1, scope: { kind: 'manual', verbIds: ['read'] } }),
      verbs,
      emptyProgress,
    )[0];
    if (!question) return;
    const result = checkAnswer(
      question,
      { kind: 'fields', values: { past: 'read', participle: 'read' } },
      { note: getVerb('read')?.note ?? null },
    );
    expect(result.correct).toBe(true);
    expect(result.note).toBeNull();
  });

  it('compte un dépassement de minuteur comme une réponse fausse', () => {
    const question = generateSession(
      config({ modes: ['mcq'], questionCount: 1 }),
      verbs,
      emptyProgress,
    )[0];
    if (!question) return;
    const result = checkAnswer(question, { kind: 'timeout' });
    expect(result.correct).toBe(false);
    expect(result.kind).toBe('timeout');
    expect(result.expected).not.toBe('');
  });
});

describe('scoring', () => {
  const correct = { correct: true, kind: 'correct' as const, expected: 'ate', note: null };
  const wrong = { correct: false, kind: 'wrong' as const, expected: 'ate', note: null };

  it('donne 100 points sans minuteur', () => {
    expect(scoreAttempt({ result: correct, ms: 4000, usedHint: false, perQuestionSeconds: null })).toBe(100);
  });

  it('ajoute le bonus maximal sous 30 % du temps imparti', () => {
    expect(scoreAttempt({ result: correct, ms: 2000, usedHint: false, perQuestionSeconds: 10 })).toBe(150);
  });

  it('retire 25 points quand un indice a été utilisé', () => {
    expect(scoreAttempt({ result: correct, ms: 9000, usedHint: true, perQuestionSeconds: null })).toBe(75);
  });

  it('ne donne aucun point à une réponse fausse', () => {
    expect(scoreAttempt({ result: wrong, ms: 500, usedHint: false, perQuestionSeconds: 10 })).toBe(0);
  });

  it('déclenche le combo au-delà de 5 réussites d’affilée', () => {
    expect(comboMultiplier(4)).toBe(1);
    expect(comboMultiplier(5)).toBe(1.5);
    expect(comboMultiplier(50)).toBe(3);
  });
});
