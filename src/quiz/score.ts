import type { AttemptRecord, CheckResult, QuizConfig } from './types';

/**
 * Barème du §7 : 100 points de base, bonus de rapidité jusqu'à +50 si la réponse
 * arrive sous 30 % du temps imparti, malus d'indice −25. Une réponse fausse ne
 * rapporte jamais de points, même partiellement juste.
 */

export const BASE_POINTS = 100;
export const MAX_SPEED_BONUS = 50;
export const HINT_MALUS = 25;

export function scoreAttempt({
  result,
  ms,
  usedHint,
  perQuestionSeconds,
}: {
  result: CheckResult;
  ms: number;
  usedHint: boolean;
  perQuestionSeconds: number | null;
}): number {
  if (!result.correct) return 0;

  let points = BASE_POINTS;

  if (perQuestionSeconds !== null && perQuestionSeconds > 0) {
    const limitMs = perQuestionSeconds * 1000;
    const fastThreshold = limitMs * 0.3;
    if (ms <= fastThreshold) {
      points += MAX_SPEED_BONUS;
    } else if (ms < limitMs) {
      // Décroissance linéaire du bonus entre le seuil « rapide » et la limite.
      const remaining = (limitMs - ms) / (limitMs - fastThreshold);
      points += Math.round(MAX_SPEED_BONUS * remaining);
    }
  }

  if (usedHint) points -= HINT_MALUS;

  return Math.max(0, points);
}

/** Multiplicateur de combo du Speed Run : au-delà de 5 réussites d'affilée. */
export function comboMultiplier(streak: number): number {
  if (streak < 5) return 1;
  return Math.min(3, 1 + Math.floor(streak / 5) * 0.5);
}

export interface SessionTotals {
  questionCount: number;
  correctCount: number;
  score: number;
  avgMs: number;
  accuracy: number;
  missedVerbIds: string[];
  accuracyByPattern: Record<string, { correct: number; total: number }>;
  accuracyByGroup: Record<string, { correct: number; total: number }>;
}

export function summarize(
  attempts: AttemptRecord[],
  meta: {
    patternOf: (verbId: string) => string | null;
    groupOf: (verbId: string) => string | null;
  },
): SessionTotals {
  const correctCount = attempts.filter((attempt) => attempt.result.correct).length;
  const totalMs = attempts.reduce((sum, attempt) => sum + attempt.ms, 0);
  const missed = new Set<string>();
  const byPattern: Record<string, { correct: number; total: number }> = {};
  const byGroup: Record<string, { correct: number; total: number }> = {};

  for (const attempt of attempts) {
    for (const verbId of attempt.verbIds) {
      if (!attempt.result.correct) missed.add(verbId);

      const pattern = meta.patternOf(verbId);
      if (pattern) {
        const entry = (byPattern[pattern] ??= { correct: 0, total: 0 });
        entry.total += 1;
        if (attempt.result.correct) entry.correct += 1;
      }

      const group = meta.groupOf(verbId);
      if (group) {
        const entry = (byGroup[group] ??= { correct: 0, total: 0 });
        entry.total += 1;
        if (attempt.result.correct) entry.correct += 1;
      }
    }
  }

  return {
    questionCount: attempts.length,
    correctCount,
    score: attempts.reduce((sum, attempt) => sum + attempt.points, 0),
    avgMs: attempts.length === 0 ? 0 : Math.round(totalMs / attempts.length),
    accuracy: attempts.length === 0 ? 0 : correctCount / attempts.length,
    missedVerbIds: [...missed],
    accuracyByPattern: byPattern,
    accuracyByGroup: byGroup,
  };
}

/** Durée de réponse plafonnée par le minuteur, pour ne pas fausser la moyenne. */
export function clampMs(ms: number, config: QuizConfig): number {
  if (config.perQuestionSeconds === null) return Math.max(0, ms);
  return Math.min(Math.max(0, ms), config.perQuestionSeconds * 1000);
}
