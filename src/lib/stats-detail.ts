import type { HuitoGroup, Pattern, Verb } from '@/data/schema';
import type { SessionSummary, VerbProgress } from '@/store/progress';

/**
 * Agrégations de la page Statistiques.
 * Fonctions pures : elles prennent la progression et le dataset, ne lisent ni
 * l'horloge (sauf paramètre `now`) ni le store, et sont donc testables telles quelles.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export interface DayPoint {
  day: number;
  questions: number;
  correct: number;
  /** `null` quand aucune session ce jour-là : la courbe ne doit pas inventer un 0 %. */
  accuracy: number | null;
}

/** Série journalière sur `days` jours, du plus ancien au plus récent, trous compris. */
export function dailySeries(
  sessions: SessionSummary[],
  days: number,
  now = Date.now(),
): DayPoint[] {
  const today = startOfDay(now);
  const buckets = new Map<number, { questions: number; correct: number }>();

  for (const session of sessions) {
    const day = startOfDay(session.finishedAt);
    if (day < today - (days - 1) * DAY_MS || day > today) continue;
    const bucket = buckets.get(day) ?? { questions: 0, correct: 0 };
    bucket.questions += session.questionCount;
    bucket.correct += session.correctCount;
    buckets.set(day, bucket);
  }

  return Array.from({ length: days }, (_, index) => {
    const day = today - (days - 1 - index) * DAY_MS;
    const bucket = buckets.get(day);
    return {
      day,
      questions: bucket?.questions ?? 0,
      correct: bucket?.correct ?? 0,
      accuracy: bucket && bucket.questions > 0 ? bucket.correct / bucket.questions : null,
    };
  });
}

export interface HeatmapCell {
  day: number;
  questions: number;
  /** 0 = aucune activité, 1 à 4 = intensité relative au maximum de la période. */
  level: 0 | 1 | 2 | 3 | 4;
}

/**
 * Heatmap d'assiduité, alignée sur les semaines (lundi en première ligne).
 * L'intensité est relative au jour le plus chargé de la période : une semaine
 * calme reste lisible même sans record absolu.
 */
export function heatmap(
  sessions: SessionSummary[],
  weeks: number,
  now = Date.now(),
): HeatmapCell[][] {
  const today = startOfDay(now);
  // Lundi = 0 … dimanche = 6.
  const weekdayIndex = (new Date(today).getDay() + 6) % 7;
  const lastMonday = today - weekdayIndex * DAY_MS;
  const firstDay = lastMonday - (weeks - 1) * 7 * DAY_MS;

  const perDay = new Map<number, number>();
  for (const session of sessions) {
    const day = startOfDay(session.finishedAt);
    if (day < firstDay || day > today) continue;
    perDay.set(day, (perDay.get(day) ?? 0) + session.questionCount);
  }

  const max = Math.max(0, ...perDay.values());

  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday): HeatmapCell => {
      const day = firstDay + week * 7 * DAY_MS + weekday * DAY_MS;
      const questions = perDay.get(day) ?? 0;
      const level =
        questions === 0 || max === 0
          ? 0
          : (Math.min(4, Math.ceil((questions / max) * 4)) as 1 | 2 | 3 | 4);
      return { day, questions, level };
    }),
  );
}

export interface MissedVerb {
  verbId: string;
  /** Nombre de sessions où le verbe est ressorti faux. */
  misses: number;
  attempts: number;
  accuracy: number | null;
}

/** Les verbes les plus souvent ratés, du pire au moins pire. */
export function topMissed(
  sessions: SessionSummary[],
  byVerb: Record<string, VerbProgress>,
  limit = 10,
): MissedVerb[] {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    for (const verbId of session.missedVerbIds) {
      counts.set(verbId, (counts.get(verbId) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([verbId, misses]): MissedVerb => {
      const entry = byVerb[verbId];
      return {
        verbId,
        misses,
        attempts: entry?.attempts ?? 0,
        accuracy:
          entry && entry.attempts > 0 ? entry.correct / entry.attempts : null,
      };
    })
    .sort((a, b) => {
      if (b.misses !== a.misses) return b.misses - a.misses;
      return (a.accuracy ?? 1) - (b.accuracy ?? 1);
    })
    .slice(0, limit);
}

export interface GroupStat<K extends string> {
  key: K;
  attempts: number;
  correct: number;
  accuracy: number | null;
  /** Verbes de cette catégorie déjà rencontrés au moins une fois. */
  seen: number;
  total: number;
}

function accumulate<K extends string>(
  verbs: Verb[],
  byVerb: Record<string, VerbProgress>,
  keyOf: (verb: Verb) => K | null,
): GroupStat<K>[] {
  const stats = new Map<K, GroupStat<K>>();

  for (const verb of verbs) {
    const key = keyOf(verb);
    if (key === null) continue;

    const stat = stats.get(key) ?? {
      key,
      attempts: 0,
      correct: 0,
      accuracy: null,
      seen: 0,
      total: 0,
    };
    stat.total += 1;

    const entry = byVerb[verb.id];
    if (entry && entry.attempts > 0) {
      stat.seen += 1;
      stat.attempts += entry.attempts;
      stat.correct += entry.correct;
    }
    stats.set(key, stat);
  }

  return [...stats.values()]
    .map((stat) => ({
      ...stat,
      accuracy: stat.attempts > 0 ? stat.correct / stat.attempts : null,
    }))
    .sort((a, b) => {
      // Les catégories jamais travaillées passent en fin de liste, pas en tête.
      if (a.accuracy === null && b.accuracy === null) return a.key.localeCompare(b.key);
      if (a.accuracy === null) return 1;
      if (b.accuracy === null) return -1;
      return a.accuracy - b.accuracy;
    });
}

export function byPattern(
  verbs: Verb[],
  byVerb: Record<string, VerbProgress>,
): GroupStat<Pattern>[] {
  return accumulate(verbs, byVerb, (verb) => verb.pattern);
}

export function byHuitoGroup(
  verbs: Verb[],
  byVerb: Record<string, VerbProgress>,
): GroupStat<HuitoGroup>[] {
  return accumulate(verbs, byVerb, (verb) => verb.huitoGroup);
}

export interface BoxDistribution {
  box: number;
  count: number;
}

/** Répartition dans les cinq boîtes de Leitner, verbes jamais vus exclus. */
export function boxDistribution(byVerb: Record<string, VerbProgress>): BoxDistribution[] {
  const counts = new Map<number, number>();
  for (const entry of Object.values(byVerb)) {
    if (entry.attempts === 0) continue;
    counts.set(entry.box, (counts.get(entry.box) ?? 0) + 1);
  }
  return Array.from({ length: 5 }, (_, index) => ({
    box: index + 1,
    count: counts.get(index + 1) ?? 0,
  }));
}
