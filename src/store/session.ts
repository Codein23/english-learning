import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createJSONStorage } from '@/lib/storage';
import { getVerb, verbs } from '@/data/verbs';
import { checkAnswer, type AnswerInput } from '@/quiz/check';
import { generateSession } from '@/quiz/generate';
import { clampMs, comboMultiplier, scoreAttempt, summarize } from '@/quiz/score';
import {
  DEFAULT_CONFIG,
  type AttemptRecord,
  type CheckResult,
  type ProgressSnapshot,
  type Question,
  type QuizConfig,
} from '@/quiz/types';
import { useProgress } from './progress';

export type SessionStatus = 'idle' | 'running' | 'finished';

interface SessionState {
  status: SessionStatus;
  config: QuizConfig;
  questions: Question[];
  index: number;
  attempts: AttemptRecord[];
  startedAt: number;
  questionStartedAt: number;
  /** Résultat de la question courante, tant qu'elle n'a pas été validée. */
  lastResult: CheckResult | null;
  hintUsed: boolean;
  combo: number;
  bestCombo: number;

  start: (config: QuizConfig) => number;
  submit: (input: AnswerInput) => CheckResult | null;
  next: () => void;
  useHint: () => void;
  finish: () => void;
  abandon: () => void;
}

/** Derniers réglages, rechargés par défaut à l'ouverture du setup (§5). */
interface LastConfigState {
  config: QuizConfig;
  setConfig: (config: QuizConfig) => void;
}

export const useLastConfig = create<LastConfigState>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,
      setConfig: (config) => set({ config }),
    }),
    {
      name: 'lastQuizConfig',
      version: 1,
      storage: createJSONStorage<LastConfigState>('lastQuizConfig'),
      partialize: (state) => ({ config: state.config }) as LastConfigState,
    },
  ),
);

function snapshot(): ProgressSnapshot {
  const state = useProgress.getState();
  const mistakes = new Set<string>();
  for (const session of state.sessions) {
    for (const verbId of session.missedVerbIds) mistakes.add(verbId);
  }
  return {
    byVerb: Object.fromEntries(
      Object.entries(state.byVerb).map(([id, entry]) => [
        id,
        {
          attempts: entry.attempts,
          correct: entry.correct,
          streak: entry.streak,
          box: entry.box,
          lastSeen: entry.lastSeen,
        },
      ]),
    ),
    favorites: state.favorites,
    mistakeVerbIds: [...mistakes],
  };
}

const DICTATION_HEAD_KEY = 'el:v1:lastDictationHead';

function randomSeed(): number {
  try {
    if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
      return crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now();
    }
  } catch {}
  return Date.now();
}

function dictationHeadOf(questions: Question[]): string[] {
  return questions.slice(0, 3).map((question) => question.verbIds[0] ?? question.id);
}

function readLastDictationHead(): string[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(DICTATION_HEAD_KEY);
    if (!raw) return [];
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeLastDictationHead(head: string[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(DICTATION_HEAD_KEY, JSON.stringify(head));
  } catch {}
}

export const useSession = create<SessionState>()((set, get) => ({
  status: 'idle',
  config: DEFAULT_CONFIG,
  questions: [],
  index: 0,
  attempts: [],
  startedAt: 0,
  questionStartedAt: 0,
  lastResult: null,
  hintUsed: false,
  combo: 0,
  bestCombo: 0,

  /** Démarre une session et renvoie le nombre de questions réellement générées. */
  start: (config) => {
    const dictationMode = config.modes.includes('dictation');
    let seeded: QuizConfig = {
      ...config,
      seed: randomSeed(),
      audioOnReveal: dictationMode ? true : config.audioOnReveal,
      shuffle: dictationMode ? true : config.shuffle,
      srsWeighting: dictationMode ? true : config.srsWeighting,
    };
    let questions = generateSession(seeded, verbs, snapshot());

    if (dictationMode && questions.length > 0) {
      const previousHead = readLastDictationHead();
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const currentHead = dictationHeadOf(questions);
        if (
          previousHead.length === 0 ||
          currentHead.length === 0 ||
          currentHead.join('|') !== previousHead.join('|')
        ) {
          break;
        }
        seeded = { ...seeded, seed: randomSeed() + attempt + 1 };
        questions = generateSession(seeded, verbs, snapshot());
      }
      writeLastDictationHead(dictationHeadOf(questions));
    }

    const now = Date.now();

    set({
      status: questions.length > 0 ? 'running' : 'idle',
      config: seeded,
      questions,
      index: 0,
      attempts: [],
      startedAt: now,
      questionStartedAt: now,
      lastResult: null,
      hintUsed: false,
      combo: 0,
      bestCombo: 0,
    });

    useLastConfig.getState().setConfig({ ...seeded, seed: 0 });
    return questions.length;
  },

  submit: (input) => {
    const state = get();
    const question = state.questions[state.index];
    if (!question || state.status !== 'running' || state.lastResult !== null) return null;

    const notesByVerb = Object.fromEntries(
      question.verbIds.map((verbId) => [verbId, getVerb(verbId)?.note ?? null]),
    );
    const result = checkAnswer(question, input, {
      note: notesByVerb[question.verbIds[0] ?? ''] ?? null,
      notesByVerb,
    });

    const ms = clampMs(Date.now() - state.questionStartedAt, state.config);
    const combo = result.correct ? state.combo + 1 : 0;
    const basePoints = scoreAttempt({
      result,
      ms,
      usedHint: state.hintUsed,
      perQuestionSeconds: state.config.perQuestionSeconds,
    });
    const points =
      state.config.modes.includes('speed') || question.mode === 'speed'
        ? Math.round(basePoints * comboMultiplier(combo))
        : basePoints;

    const attempt: AttemptRecord = {
      questionId: question.id,
      verbIds: question.verbIds,
      mode: question.mode,
      result,
      ms,
      usedHint: state.hintUsed,
      points,
    };

    // La progression par verbe est mise à jour immédiatement : une session
    // interrompue ne perd pas ce qui a déjà été travaillé.
    const progress = useProgress.getState();
    for (const verbId of question.verbIds) {
      progress.recordAttempt({
        verbId,
        correct: result.correct,
        ms: Math.round(ms / Math.max(1, question.verbIds.length)),
        usedHint: state.hintUsed,
      });
    }

    set({
      attempts: [...state.attempts, attempt],
      lastResult: result,
      combo,
      bestCombo: Math.max(state.bestCombo, combo),
    });

    return result;
  },

  next: () => {
    const state = get();
    if (state.index + 1 >= state.questions.length) {
      get().finish();
      return;
    }
    set({
      index: state.index + 1,
      lastResult: null,
      hintUsed: false,
      questionStartedAt: Date.now(),
    });
  },

  useHint: () => set({ hintUsed: true }),

  finish: () => {
    const state = get();
    if (state.status === 'finished') return;

    const totals = summarize(state.attempts, {
      patternOf: (verbId) => getVerb(verbId)?.pattern ?? null,
      groupOf: (verbId) => getVerb(verbId)?.huitoGroup ?? null,
    });

    if (state.attempts.length > 0) {
      useProgress.getState().recordSession({
        id: `${state.startedAt}`,
        finishedAt: Date.now(),
        questionCount: totals.questionCount,
        correctCount: totals.correctCount,
        avgMs: totals.avgMs,
        score: totals.score,
        missedVerbIds: totals.missedVerbIds,
      });
    }

    set({ status: 'finished', lastResult: null });
  },

  abandon: () => set({ status: 'idle', questions: [], attempts: [], index: 0 }),
}));

export function sessionTotals(attempts: AttemptRecord[]) {
  return summarize(attempts, {
    patternOf: (verbId) => getVerb(verbId)?.pattern ?? null,
    groupOf: (verbId) => getVerb(verbId)?.huitoGroup ?? null,
  });
}
