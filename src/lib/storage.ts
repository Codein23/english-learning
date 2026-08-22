import type { PersistStorage, StorageValue } from 'zustand/middleware';

/**
 * Couche de persistance versionnée.
 * Toutes les clés sont préfixées `el:v1:` ; le passage à `v2` se fera par une
 * fonction de migration déclarée ici, jamais par une lecture directe ailleurs.
 * Aucune écriture ne peut faire planter l'application (mode privé Safari,
 * quota dépassé, `localStorage` désactivé).
 */

export const STORAGE_VERSION = 1 as const;
const PREFIX = `el:v${STORAGE_VERSION}:` as const;

export type StorageKey = 'settings' | 'progress' | 'session' | 'lastQuizConfig';

export function storageKey(key: StorageKey): string {
  return `${PREFIX}${key}`;
}

function memoryFallback(): Storage | null {
  return null;
}

function getBackend(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return memoryFallback();
    const probe = `${PREFIX}__probe`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return memoryFallback();
  }
}

const backend = getBackend();

/** Vrai si la progression peut réellement être persistée sur cet appareil. */
export const isPersistenceAvailable = backend !== null;

export function readRaw(key: StorageKey): string | null {
  try {
    return backend?.getItem(storageKey(key)) ?? null;
  } catch {
    return null;
  }
}

export function writeRaw(key: StorageKey, value: string): boolean {
  try {
    backend?.setItem(storageKey(key), value);
    return backend !== null;
  } catch {
    // Quota dépassé ou stockage refusé : l'application continue en mémoire.
    return false;
  }
}

export function removeRaw(key: StorageKey): void {
  try {
    backend?.removeItem(storageKey(key));
  } catch {
    /* rien à faire : l'absence de persistance n'est jamais bloquante */
  }
}

/** Efface toutes les données de l'application, et rien d'autre. */
export function clearAll(): void {
  try {
    if (!backend) return;
    const keys: string[] = [];
    for (let index = 0; index < backend.length; index += 1) {
      const key = backend.key(index);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    for (const key of keys) backend.removeItem(key);
  } catch {
    /* idem */
  }
}

/**
 * Adaptateur `zustand/persist` typé, branché sur la couche ci-dessus.
 * Le `version` de zustand reste indépendant : il gère la forme du state,
 * `STORAGE_VERSION` gère l'espace de noms des clés.
 */
export function createJSONStorage<T>(key: StorageKey): PersistStorage<T> {
  return {
    getItem: (): StorageValue<T> | null => {
      const raw = readRaw(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as StorageValue<T>;
      } catch {
        // Donnée corrompue : on repart d'un état propre plutôt que de planter.
        removeRaw(key);
        return null;
      }
    },
    setItem: (_name, value): void => {
      writeRaw(key, JSON.stringify(value));
    },
    removeItem: (): void => {
      removeRaw(key);
    },
  };
}
