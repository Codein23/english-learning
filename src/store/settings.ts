import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createJSONStorage } from '@/lib/storage';

export type ThemePreference = 'light' | 'dark' | 'system';
export type Accent = 'us' | 'uk';

export interface SettingsState {
  theme: ThemePreference;
  accent: Accent;
  volume: number;
  /** Lecture automatique de la bonne forme au dévoilement d'une correction (§9.4). */
  autoPlayAudio: boolean;
  setTheme: (theme: ThemePreference) => void;
  setAccent: (accent: Accent) => void;
  setVolume: (volume: number) => void;
  setAutoPlayAudio: (enabled: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      accent: 'us',
      volume: 1,
      autoPlayAudio: true,
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)) }),
      setAutoPlayAudio: (autoPlayAudio) => set({ autoPlayAudio }),
    }),
    {
      name: 'settings',
      version: 1,
      storage: createJSONStorage<SettingsState>('settings'),
      partialize: (state) =>
        ({
          theme: state.theme,
          accent: state.accent,
          volume: state.volume,
          autoPlayAudio: state.autoPlayAudio,
        }) as SettingsState,
    },
  ),
);

/** Résout la préférence en thème effectif, en tenant compte du système. */
export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference !== 'system') return preference;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
