import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSession, useLastConfig } from '@/store/session';
import { DEFAULT_CONFIG } from '@/quiz/types';

vi.mock('@/data/verbs', () => ({
  verbs: [
    { id: 'be', base: 'be', past: ['was'], participle: ['been'], fr: ['être'], tier: 1, pattern: 'ABB', huitoGroup: 'BE', note: null },
    { id: 'go', base: 'go', past: ['went'], participle: ['gone'], fr: ['aller'], tier: 1, pattern: 'ABC', huitoGroup: 'GO', note: null },
  ],
  getVerb: () => undefined,
}));

vi.mock('@/store/progress', () => ({
  useProgress: {
    getState: () => ({
      byVerb: {},
      favorites: [],
      sessions: [],
      recordAttempt: vi.fn(),
      recordSession: vi.fn(),
    }),
  },
}));

describe('session seeding', () => {
  beforeEach(() => {
    useSession.setState({
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
    });
    useLastConfig.setState({ config: DEFAULT_CONFIG, setConfig: useLastConfig.getState().setConfig });
  });

  it('reseeds each started session and does not persist the runtime seed', () => {
    const start = useSession.getState().start;

    start({ ...DEFAULT_CONFIG, modes: ['dictation'], questionCount: 2, seed: 12345, srsWeighting: false, shuffle: true });
    const firstSeed = useSession.getState().config.seed;
    const persistedFirst = useLastConfig.getState().config.seed;

    start({ ...DEFAULT_CONFIG, modes: ['dictation'], questionCount: 2, seed: 12345, srsWeighting: false, shuffle: true });
    const secondSeed = useSession.getState().config.seed;
    const persistedSecond = useLastConfig.getState().config.seed;

    // Le seed d'entrée est ignoré et remplacé par un aléa frais à chaque session :
    // deux démarrages successifs produisent donc des seeds différents.
    // En jsdom/Node, la source d'aléa est `crypto.getRandomValues` (pas `Date.now`),
    // on ne fixe donc pas de valeurs exactes — on vérifie l'invariant réel.
    expect(firstSeed).not.toBe(secondSeed);
    // Le seed runtime ne doit jamais être persisté dans les réglages.
    expect(persistedFirst).toBe(0);
    expect(persistedSecond).toBe(0);
  });
});