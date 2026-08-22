import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createJSONStorage } from '@/lib/storage';

/**
 * Progression par verbe + historique de sessions.
 * Alimente : la pondération SRS du setup, la page Stats, le badge « maîtrisé »
 * du tableau des verbes, et le périmètre « erreurs passées uniquement ».
 */

/** Boîtes de Leitner : intervalles 1 / 2 / 4 / 8 / 16 jours. */
export const LEITNER_INTERVALS_DAYS = [1, 2, 4, 8, 16] as const;
export const MAX_BOX = 5;

export interface VerbProgress {
  attempts: number;
  correct: number;
  /** Réussites consécutives sans indice — remis à 0 à la première erreur. */
  streak: number;
  /** Boîte de Leitner, 1 à 5. */
  box: number;
  /** Timestamp epoch ms de la dernière rencontre, `null` si jamais vu. */
  lastSeen: number | null;
  /** Temps de réponse moyen en millisecondes. */
  avgMs: number;
}

export interface SessionSummary {
  id: string;
  /** Timestamp epoch ms de fin de session. */
  finishedAt: number;
  questionCount: number;
  correctCount: number;
  /** Temps de réponse moyen sur la session, en millisecondes. */
  avgMs: number;
  score: number;
  /** Identifiants des verbes ratés — alimente « rejouer les erreurs ». */
  missedVerbIds: string[];
}

export const emptyVerbProgress: VerbProgress = {
  attempts: 0,
  correct: 0,
  streak: 0,
  box: 1,
  lastSeen: null,
  avgMs: 0,
};

export interface RecordAttemptInput {
  verbId: string;
  correct: boolean;
  /** Temps de réponse en millisecondes. */
  ms: number;
  /** Un indice utilisé casse la série : la maîtrise exige 3 réussites sans indice. */
  usedHint?: boolean;
}

export interface ProgressState {
  byVerb: Record<string, VerbProgress>;
  favorites: string[];
  sessions: SessionSummary[];
  recordAttempt: (input: RecordAttemptInput) => void;
  recordSession: (summary: SessionSummary) => void;
  toggleFavorite: (verbId: string) => void;
  reset: () => void;
  /** Remplace intégralement l'état — utilisé par l'import JSON de `#/settings`. */
  hydrate: (state: Pick<ProgressState, 'byVerb' | 'favorites' | 'sessions'>) => void;
}

/** « Maîtrisé » = 3 réussites consécutives sans indice ET boîte ≥ 4 (§7). */
export function isMastered(progress: VerbProgress | undefined): boolean {
  if (!progress) return false;
  return progress.streak >= 3 && progress.box >= 4;
}

export function accuracy(progress: VerbProgress | undefined): number | null {
  if (!progress || progress.attempts === 0) return null;
  return progress.correct / progress.attempts;
}

/** Date de prochaine révision selon la boîte de Leitner, `null` si jamais vu. */
export function dueAt(progress: VerbProgress | undefined): number | null {
  if (!progress || progress.lastSeen === null) return null;
  const index = Math.min(progress.box, MAX_BOX) - 1;
  const days = LEITNER_INTERVALS_DAYS[index] ?? 1;
  return progress.lastSeen + days * 24 * 60 * 60 * 1000;
}

const MAX_SESSIONS_KEPT = 200;

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      byVerb: {},
      favorites: [],
      sessions: [],

      recordAttempt: ({ verbId, correct, ms, usedHint = false }) =>
        set((state) => {
          const previous = state.byVerb[verbId] ?? emptyVerbProgress;
          const attempts = previous.attempts + 1;
          const streak = correct && !usedHint ? previous.streak + 1 : 0;
          const box = correct
            ? Math.min(MAX_BOX, previous.box + 1)
            : Math.max(1, previous.box - 1);

          return {
            byVerb: {
              ...state.byVerb,
              [verbId]: {
                attempts,
                correct: previous.correct + (correct ? 1 : 0),
                streak,
                box,
                lastSeen: Date.now(),
                // Moyenne mobile exacte, pas une approximation glissante.
                avgMs: Math.round((previous.avgMs * previous.attempts + ms) / attempts),
              },
            },
          };
        }),

      recordSession: (summary) =>
        set((state) => ({
          sessions: [summary, ...state.sessions].slice(0, MAX_SESSIONS_KEPT),
        })),

      toggleFavorite: (verbId) =>
        set((state) => ({
          favorites: state.favorites.includes(verbId)
            ? state.favorites.filter((id) => id !== verbId)
            : [...state.favorites, verbId],
        })),

      reset: () => set({ byVerb: {}, favorites: [], sessions: [] }),

      hydrate: ({ byVerb, favorites, sessions }) => set({ byVerb, favorites, sessions }),
    }),
    {
      name: 'progress',
      version: 1,
      storage: createJSONStorage<ProgressState>('progress'),
      partialize: (state) =>
        ({
          byVerb: state.byVerb,
          favorites: state.favorites,
          sessions: state.sessions,
        }) as ProgressState,
    },
  ),
);
