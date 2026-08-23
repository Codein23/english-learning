import { describe, expect, it } from 'vitest';
import {
  boxDistribution,
  byHuitoGroup,
  byPattern,
  dailySeries,
  heatmap,
  startOfDay,
  topMissed,
} from './stats-detail';
import type { SessionSummary, VerbProgress } from '@/store/progress';
import type { Verb } from '@/data/schema';

const DAY = 24 * 60 * 60 * 1000;
// Mercredi 11 mars 2026, midi — jour de semaine fixe pour la heatmap.
const NOW = new Date('2026-03-11T12:00:00').getTime();

function session(daysAgo: number, patch: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: `s-${daysAgo}-${patch.id ?? ''}`,
    finishedAt: NOW - daysAgo * DAY,
    questionCount: 10,
    correctCount: 5,
    avgMs: 3000,
    score: 500,
    missedVerbIds: [],
    ...patch,
  };
}

function entry(patch: Partial<VerbProgress> = {}): VerbProgress {
  return { attempts: 0, correct: 0, streak: 0, box: 1, lastSeen: null, avgMs: 0, ...patch };
}

function verb(id: string, patch: Partial<Verb> = {}): Verb {
  return {
    id,
    base: id,
    past: [`${id}ed`],
    participle: [`${id}ed`],
    fr: [id],
    pattern: 'ABB',
    huitoGroup: null,
    rank: null,
    tier: 3,
    tags: [],
    note: null,
    ipa: null,
    example: null,
    ...patch,
  };
}

describe('dailySeries', () => {
  it('renvoie une entrée par jour, trous compris', () => {
    const series = dailySeries([session(0), session(3)], 7, NOW);
    expect(series).toHaveLength(7);
    expect(series[6]?.questions).toBe(10);
    expect(series[5]?.questions).toBe(0);
  });

  it('laisse la précision à null les jours sans session, sans inventer un zéro', () => {
    const series = dailySeries([session(0)], 5, NOW);
    expect(series[4]?.accuracy).toBeCloseTo(0.5, 5);
    expect(series[0]?.accuracy).toBeNull();
  });

  it('agrège plusieurs sessions du même jour', () => {
    const series = dailySeries(
      [
        session(1, { id: 'a', questionCount: 10, correctCount: 10 }),
        session(1, { id: 'b', questionCount: 10, correctCount: 0 }),
      ],
      3,
      NOW,
    );
    const yesterday = series[1];
    expect(yesterday?.questions).toBe(20);
    expect(yesterday?.accuracy).toBeCloseTo(0.5, 5);
  });

  it('ignore les sessions hors fenêtre', () => {
    const series = dailySeries([session(40)], 7, NOW);
    expect(series.every((point) => point.questions === 0)).toBe(true);
  });

  it('est ordonnée du plus ancien au plus récent', () => {
    const series = dailySeries([], 7, NOW);
    expect(series[6]?.day).toBe(startOfDay(NOW));
    expect(series[0]?.day).toBeLessThan(series[6]?.day ?? 0);
  });
});

describe('heatmap', () => {
  it('produit des semaines de 7 jours commençant le lundi', () => {
    const grid = heatmap([], 4, NOW);
    expect(grid).toHaveLength(4);
    expect(grid[0]).toHaveLength(7);
    // Le premier jour de chaque semaine est un lundi (getDay() === 1).
    expect(new Date(grid[0]?.[0]?.day ?? 0).getDay()).toBe(1);
  });

  it('gradue l’intensité relativement au jour le plus chargé', () => {
    const grid = heatmap(
      [
        session(0, { id: 'gros', questionCount: 100 }),
        session(1, { id: 'petit', questionCount: 5 }),
      ],
      4,
      NOW,
    );
    const cells = grid.flat();
    const gros = cells.find((cell) => cell.questions === 100);
    const petit = cells.find((cell) => cell.questions === 5);
    expect(gros?.level).toBe(4);
    expect(petit?.level).toBe(1);
  });

  it('met tout à zéro quand il n’y a aucune session', () => {
    expect(heatmap([], 4, NOW).flat().every((cell) => cell.level === 0)).toBe(true);
  });
});

describe('topMissed', () => {
  it('classe les verbes du plus souvent raté au moins raté', () => {
    const sessions = [
      session(0, { id: 'a', missedVerbIds: ['read', 'lie'] }),
      session(1, { id: 'b', missedVerbIds: ['read'] }),
      session(2, { id: 'c', missedVerbIds: ['read', 'lie', 'hang'] }),
    ];
    const result = topMissed(sessions, {});
    expect(result.map((item) => item.verbId)).toEqual(['read', 'lie', 'hang']);
    expect(result[0]?.misses).toBe(3);
  });

  it('joint la précision issue de la progression par verbe', () => {
    const result = topMissed(
      [session(0, { missedVerbIds: ['read'] })],
      { read: entry({ attempts: 10, correct: 3 }) },
    );
    expect(result[0]?.accuracy).toBeCloseTo(0.3, 5);
    expect(result[0]?.attempts).toBe(10);
  });

  it('respecte la limite demandée', () => {
    const sessions = [session(0, { missedVerbIds: ['a', 'b', 'c', 'd'] })];
    expect(topMissed(sessions, {}, 2)).toHaveLength(2);
  });

  it('renvoie une liste vide sans erreur quand rien n’a été raté', () => {
    expect(topMissed([session(0)], {})).toEqual([]);
  });
});

describe('répartitions', () => {
  const dataset = [
    verb('cut', { pattern: 'AAA', huitoGroup: 'TRIPLETS' }),
    verb('put', { pattern: 'AAA', huitoGroup: 'TRIPLETS' }),
    verb('buy', { pattern: 'ABB', huitoGroup: 'GHT' }),
    verb('eat', { pattern: 'ABC', huitoGroup: null }),
  ];

  it('agrège les tentatives par schéma', () => {
    const stats = byPattern(dataset, {
      cut: entry({ attempts: 10, correct: 5 }),
      put: entry({ attempts: 10, correct: 9 }),
      buy: entry({ attempts: 10, correct: 1 }),
    });

    const aaa = stats.find((stat) => stat.key === 'AAA');
    expect(aaa?.attempts).toBe(20);
    expect(aaa?.accuracy).toBeCloseTo(0.7, 5);
    expect(aaa?.seen).toBe(2);
    expect(aaa?.total).toBe(2);
  });

  it('classe du plus faible au plus solide, catégories jamais vues en dernier', () => {
    const stats = byPattern(dataset, {
      cut: entry({ attempts: 10, correct: 9 }),
      put: entry({ attempts: 10, correct: 9 }),
      buy: entry({ attempts: 10, correct: 1 }),
    });
    expect(stats.map((stat) => stat.key)).toEqual(['ABB', 'AAA', 'ABC']);
    expect(stats[2]?.accuracy).toBeNull();
  });

  it('ignore les verbes sans groupe Huito', () => {
    const stats = byHuitoGroup(dataset, {});
    expect(stats.map((stat) => stat.key).sort()).toEqual(['GHT', 'TRIPLETS']);
  });
});

describe('boxDistribution', () => {
  it('compte les verbes par boîte, en excluant ceux jamais vus', () => {
    const distribution = boxDistribution({
      a: entry({ attempts: 3, box: 1 }),
      b: entry({ attempts: 3, box: 4 }),
      c: entry({ attempts: 3, box: 4 }),
      jamais: entry({ attempts: 0, box: 1 }),
    });
    expect(distribution).toHaveLength(5);
    expect(distribution[0]?.count).toBe(1);
    expect(distribution[3]?.count).toBe(2);
    expect(distribution[4]?.count).toBe(0);
  });
});
