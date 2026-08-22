import { isMastered, type ProgressState, type SessionSummary } from '@/store/progress';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Overview {
  masteredCount: number;
  seenCount: number;
  /** Précision sur les 7 derniers jours, `null` si aucune session sur la période. */
  accuracy7d: number | null;
  /** Nombre de jours consécutifs avec au moins une session, aujourd'hui inclus. */
  streakDays: number;
  totalSessions: number;
}

function dayStamp(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Série d'assiduité : jours consécutifs avec au moins une session terminée.
 * Une session aujourd'hui ou hier maintient la série ; deux jours d'absence la coupe.
 */
export function computeStreakDays(sessions: SessionSummary[], now = Date.now()): number {
  if (sessions.length === 0) return 0;

  const days = new Set(sessions.map((session) => dayStamp(session.finishedAt)));
  const today = dayStamp(now);

  let cursor = days.has(today) ? today : today - DAY_MS;
  if (!days.has(cursor)) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

export function computeOverview(
  progress: Pick<ProgressState, 'byVerb' | 'sessions'>,
  now = Date.now(),
): Overview {
  const entries = Object.values(progress.byVerb);
  const recent = progress.sessions.filter(
    (session) => now - session.finishedAt <= 7 * DAY_MS,
  );
  const recentQuestions = recent.reduce((sum, session) => sum + session.questionCount, 0);
  const recentCorrect = recent.reduce((sum, session) => sum + session.correctCount, 0);

  return {
    masteredCount: entries.filter((entry) => isMastered(entry)).length,
    seenCount: entries.filter((entry) => entry.attempts > 0).length,
    accuracy7d: recentQuestions === 0 ? null : recentCorrect / recentQuestions,
    streakDays: computeStreakDays(progress.sessions, now),
    totalSessions: progress.sessions.length,
  };
}
