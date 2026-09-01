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
    vi.spyOn(Date, 'now').mockReturnValueOnce(111111).mockReturnValueOnce(111111).mockReturnValueOnce(222222).mockReturnValueOnce(222222);

    const start = useSession.getState().start;
    start({ ...DEFAULT_CONFIG, modes: ['dictation'], questionCount: 2, seed: 12345, srsWeighting: false, shuffle: true });
    const firstSeed = useSession.getState().config.seed;
    const persistedFirst = useLastConfig.getState().config.seed;

    start({ ...DEFAULT_CONFIG, modes: ['dictation'], questionCount: 2, seed: 12345, srsWeighting: false, shuffle: true });
    const secondSeed = useSession.getState().config.seed;
    const persistedSecond = useLastConfig.getState().config.seed;

    expect(firstSeed).toBe(111111);
    expect(secondSeed).toBe(222222);
    expect(persistedFirst).toBe(0);
    expect(persistedSecond).toBe(0);
  });
});
