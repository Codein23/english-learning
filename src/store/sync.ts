import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createJSONStorage } from '@/lib/storage';
import {
  createAccount,
  deleteAccount,
  isSyncConfigured,
  pull,
  synchronize,
  SyncError,
} from '@/sync/client';
import { generateSyncKey, isValidSyncKey, formatSyncKey } from '@/sync/crypto';
import type { SyncPayload } from '@/sync/merge';
import { useProgress } from './progress';

export type SyncStatus = 'idle' | 'syncing' | 'error';

interface SyncState {
  /** Clé secrète. Persistée localement, jamais envoyée telle quelle au serveur. */
  key: string | null;
  status: SyncStatus;
  lastSyncedAt: number | null;
  lastError: string | null;
  /** Dernière version connue côté serveur, à titre d'information. */
  version: number | null;

  enable: () => Promise<string>;
  linkDevice: (key: string) => Promise<void>;
  syncNow: () => Promise<void>;
  disable: () => void;
  forget: () => Promise<void>;
}

function localPayload(): SyncPayload {
  const progress = useProgress.getState();
  return {
    byVerb: progress.byVerb,
    favorites: progress.favorites,
    sessions: progress.sessions,
    updatedAt: Date.now(),
  };
}

function applyPayload(payload: SyncPayload): void {
  useProgress.getState().hydrate({
    byVerb: payload.byVerb,
    favorites: payload.favorites,
    sessions: payload.sessions,
  });
}

function messageOf(error: unknown): string {
  if (error instanceof SyncError) return error.message;
  return 'Erreur inattendue pendant la synchronisation.';
}

export const useSync = create<SyncState>()(
  persist(
    (set, get) => ({
      key: null,
      status: 'idle',
      lastSyncedAt: null,
      lastError: null,
      version: null,

      /** Crée un compte et pousse la progression locale. Renvoie la clé à recopier. */
      enable: async () => {
        const key = generateSyncKey();
        set({ status: 'syncing', lastError: null });
        try {
          await createAccount(key);
          const { version } = await synchronize(key, localPayload());
          set({ key, status: 'idle', version, lastSyncedAt: Date.now() });
          return key;
        } catch (error) {
          set({ status: 'error', lastError: messageOf(error) });
          throw error;
        }
      },

      /** Rattache cet appareil à un compte existant, puis fusionne les deux côtés. */
      linkDevice: async (candidate) => {
        const key = formatSyncKey(candidate);
        if (!isValidSyncKey(key)) {
          set({ status: 'error', lastError: 'Clé invalide : vérifie la recopie.' });
          throw new SyncError('Clé invalide.', 'unauthorized');
        }

        set({ status: 'syncing', lastError: null });
        try {
          // Vérifie que la clé ouvre bien un compte avant de l'enregistrer.
          await pull(key);
          const { merged, version } = await synchronize(key, localPayload());
          applyPayload(merged);
          set({ key, status: 'idle', version, lastSyncedAt: Date.now() });
        } catch (error) {
          set({ status: 'error', lastError: messageOf(error) });
          throw error;
        }
      },

      syncNow: async () => {
        const key = get().key;
        if (key === null) return;

        set({ status: 'syncing', lastError: null });
        try {
          const { merged, version } = await synchronize(key, localPayload());
          applyPayload(merged);
          set({ status: 'idle', version, lastSyncedAt: Date.now() });
        } catch (error) {
          set({ status: 'error', lastError: messageOf(error) });
        }
      },

      /** Détache l'appareil sans rien supprimer côté serveur. */
      disable: () => set({ key: null, version: null, lastSyncedAt: null, lastError: null }),

      /** Supprime définitivement les données distantes, puis détache l'appareil. */
      forget: async () => {
        const key = get().key;
        if (key === null) return;
        set({ status: 'syncing', lastError: null });
        try {
          await deleteAccount(key);
          set({ key: null, version: null, lastSyncedAt: null, status: 'idle' });
        } catch (error) {
          set({ status: 'error', lastError: messageOf(error) });
        }
      },
    }),
    {
      name: 'sync',
      version: 1,
      storage: createJSONStorage<SyncState>('sync'),
      partialize: (state) =>
        ({ key: state.key, lastSyncedAt: state.lastSyncedAt, version: state.version }) as SyncState,
    },
  ),
);

export { isSyncConfigured };
