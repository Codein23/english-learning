import { act, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizRunPage } from './QuizRun';
import { useSession } from '@/store/session';
import type { Question, QuizConfig } from '@/quiz/types';

const mockAudio = {
  available: true,
  speak: vi.fn(),
  speakSequence: vi.fn(),
  stop: vi.fn(),
};

vi.mock('@/lib/useAudio', () => ({
  useAudio: () => mockAudio,
}));

const baseConfig: QuizConfig = {
  modes: ['dictation'],
  questionCount: 2,
  perQuestionSeconds: null,
  sessionSeconds: null,
  scope: { kind: 'all' },
  direction: 'en-en',
  difficulty: 'normal',
  batchSize: 4,
  audioOnReveal: true,
  firstLetterHint: false,
  immediateFeedback: true,
  shuffle: true,
  srsWeighting: true,
  allowRepeats: false,
  seed: 1,
};

function dictationQuestion(id: string, spoken: string): Question {
  return {
    id,
    mode: 'dictation',
    verbIds: [spoken],
    prompt: 'Écoute et identifie la forme.',
    promptLang: 'fr',
    spoken,
    choices: ['x', spoken, 'y', 'z'],
    accepted: [spoken],
    choicesLang: 'en',
  };
}

describe('QuizRunPage dictation autoplay', () => {
  beforeEach(() => {
    mockAudio.speak.mockReset();
    mockAudio.speakSequence.mockReset();
    mockAudio.stop.mockReset();

    useSession.setState({
      status: 'running',
      config: baseConfig,
      questions: [dictationQuestion('q1', 'wrote'), dictationQuestion('q2', 'written')],
      index: 0,
      attempts: [],
      startedAt: Date.now(),
      questionStartedAt: Date.now(),
      lastResult: null,
      hintUsed: false,
      combo: 0,
      bestCombo: 0,
    });
  });

  it('plays the dictation audio as soon as a new question appears', async () => {
    render(
      <MemoryRouter initialEntries={['/quiz/run']}>
        <QuizRunPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mockAudio.speak).toHaveBeenCalledWith('wrote'));

    mockAudio.speak.mockClear();

    act(() => {
      useSession.setState({ index: 1, lastResult: null, questionStartedAt: Date.now() });
    });

    await waitFor(() => expect(mockAudio.speak).toHaveBeenCalledWith('written'));
  });

  it('does not autoplay dictation audio when session audio is disabled', async () => {
    useSession.setState({ config: { ...baseConfig, audioOnReveal: false } });

    render(
      <MemoryRouter initialEntries={['/quiz/run']}>
        <QuizRunPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mockAudio.speak).not.toHaveBeenCalled());
  });
});
