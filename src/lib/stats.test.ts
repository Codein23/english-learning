import { describe, expect, it } from 'vitest';
import { computeOverview, computeStreakDays } from './stats';
import type { SessionSummary } from '@/store/progress';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-03-10T14:00:00').getTime();

function session(daysAgo: number, overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: `s${daysAgo}`,
    finishedAt: NOW - daysAgo * DAY,
    questionCount: 10,
    correctCount: 8,
    avgMs: 3000,
    score: 800,
    missedVerbIds: [],
    ...overrides,
  };
}

describe('computeStreakDays', () => {
  it('vaut 0 sans aucune session', () => {
    expect(computeStreakDays([], NOW)).toBe(0);
  });

  it('compte les jours consécutifs en partant d\'aujourd\'hui', () => {
    expect(computeStreakDays([session(0), session(1), session(2)], NOW)).toBe(3);
  });

  it('reste valide si la dernière session date d\'hier', () => {
    expect(computeStreakDays([session(1), session(2)], NOW)).toBe(2);
  });

  it('se casse après deux jours sans session', () => {
    expect(computeStreakDays([session(2), session(3)], NOW)).toBe(0);
  });

  it('ne compte pas deux fois plusieurs sessions du même jour', () => {
    expect(computeStreakDays([session(0), session(0), session(1)], NOW)).toBe(2);
  });
});

describe('computeOverview', () => {
  it('renvoie une précision nulle quand aucune session ne tombe dans les 7 jours', () => {
    const overview = computeOverview({ byVerb: {}, sessions: [session(30)] }, NOW);
    expect(overview.accuracy7d).toBeNull();
    expect(overview.totalSessions).toBe(1);
  });

  it('agrège la précision sur la fenêtre de 7 jours, sessions plus anciennes exclues', () => {
    const overview = computeOverview(
      {
        byVerb: {},
        sessions: [
          session(1, { questionCount: 10, correctCount: 5 }),
          session(2, { questionCount: 10, correctCount: 9 }),
          session(20, { questionCount: 10, correctCount: 0 }),
        ],
      },
      NOW,
    );
    expect(overview.accuracy7d).toBeCloseTo(0.7, 5);
  });

  it('compte comme maîtrisé un verbe à 3 réussites d\'affilée et boîte ≥ 4', () => {
    const overview = computeOverview(
      {
        byVerb: {
          eat: { attempts: 5, correct: 4, streak: 3, box: 4, lastSeen: NOW, avgMs: 2500 },
          buy: { attempts: 5, correct: 4, streak: 3, box: 3, lastSeen: NOW, avgMs: 2500 },
          cut: { attempts: 5, correct: 4, streak: 2, box: 5, lastSeen: NOW, avgMs: 2500 },
        },
        sessions: [],
      },
      NOW,
    );
    expect(overview.masteredCount).toBe(1);
    expect(overview.seenCount).toBe(3);
  });
});
