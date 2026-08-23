import { decryptPayload, deriveAccountId, deriveToken, encryptPayload } from './crypto';
import { isSyncPayload, mergePayloads, type SyncPayload } from './merge';

/**
 * Client HTTP de synchronisation. Toute la logique de fusion vit dans `merge.ts`
 * et reste pure ; ici on ne fait que du transport et de la reprise sur conflit.
 */

export class SyncError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'network'
      | 'unauthorized'
      | 'conflict'
      | 'too_large'
      | 'corrupt'
      | 'server'
      | 'not_configured',
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

/** URL du Worker, injectée au build. Vide = synchronisation désactivée. */
export const SYNC_ENDPOINT: string = (import.meta.env.VITE_SYNC_URL ?? '')
  .trim()
  .replace(/\/$/, '');

export const isSyncConfigured = SYNC_ENDPOINT !== '';

interface PullResult {
  version: number;
  payload: SyncPayload | null;
}

async function request(path: string, init: RequestInit): Promise<Response> {
  if (!isSyncConfigured) {
    throw new SyncError('Synchronisation non configurée sur cette version.', 'not_configured');
  }
  try {
    return await fetch(`${SYNC_ENDPOINT}${path}`, init);
  } catch {
    throw new SyncError('Serveur injoignable. Réessaie une fois en ligne.', 'network');
  }
}

export async function createAccount(key: string): Promise<void> {
  const response = await request('/account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: await deriveAccountId(key),
      token: await deriveToken(key),
    }),
  });

  if (response.status === 409) {
    throw new SyncError('Ce compte existe déjà sur le serveur.', 'conflict');
  }
  if (!response.ok) {
    throw new SyncError(`Création refusée (HTTP ${response.status}).`, 'server');
  }
}

export async function pull(key: string): Promise<PullResult> {
  const accountId = await deriveAccountId(key);
  const response = await request(`/sync/${accountId}`, {
    headers: { Authorization: `Bearer ${await deriveToken(key)}` },
  });

  if (response.status === 401) {
    throw new SyncError('Clé de synchronisation inconnue ou invalide.', 'unauthorized');
  }
  if (!response.ok) {
    throw new SyncError(`Lecture refusée (HTTP ${response.status}).`, 'server');
  }

  const body = (await response.json()) as { version: number; blob: string | null };
  if (body.blob === null) return { version: body.version, payload: null };

  try {
    const payload = await decryptPayload<unknown>(key, body.blob);
    if (!isSyncPayload(payload)) {
      throw new SyncError('Données distantes illisibles.', 'corrupt');
    }
    return { version: body.version, payload };
  } catch (error) {
    if (error instanceof SyncError) throw error;
    // Déchiffrement impossible : la clé ne correspond pas à ce compte.
    throw new SyncError(
      'Impossible de déchiffrer les données : la clé ne correspond pas.',
      'unauthorized',
    );
  }
}

async function push(key: string, payload: SyncPayload, baseVersion: number): Promise<number> {
  const accountId = await deriveAccountId(key);
  const response = await request(`/sync/${accountId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${await deriveToken(key)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ baseVersion, blob: await encryptPayload(key, payload) }),
  });

  if (response.status === 409) {
    throw new SyncError('Écriture concurrente détectée.', 'conflict');
  }
  if (response.status === 413) {
    throw new SyncError('Progression trop volumineuse pour être synchronisée.', 'too_large');
  }
  if (response.status === 401) {
    throw new SyncError('Clé de synchronisation inconnue ou invalide.', 'unauthorized');
  }
  if (!response.ok) {
    throw new SyncError(`Écriture refusée (HTTP ${response.status}).`, 'server');
  }

  const body = (await response.json()) as { version: number };
  return body.version;
}

export interface SyncOutcome {
  merged: SyncPayload;
  version: number;
}

/**
 * Cycle complet : lire le distant, fusionner avec le local, réécrire.
 * En cas d'écriture concurrente le cycle est rejoué — au plus trois fois, pour
 * ne jamais boucler indéfiniment si deux appareils écrivent en rafale.
 */
export async function synchronize(key: string, local: SyncPayload): Promise<SyncOutcome> {
  let attempt = 0;

  for (;;) {
    attempt += 1;
    const remote = await pull(key);
    const merged = remote.payload ? mergePayloads(local, remote.payload) : local;

    try {
      const version = await push(key, merged, remote.version);
      return { merged, version };
    } catch (error) {
      const retryable = error instanceof SyncError && error.code === 'conflict' && attempt < 3;
      if (!retryable) throw error;
    }
  }
}

export async function deleteAccount(key: string): Promise<void> {
  const accountId = await deriveAccountId(key);
  const response = await request(`/sync/${accountId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${await deriveToken(key)}` },
  });
  if (!response.ok && response.status !== 401) {
    throw new SyncError(`Suppression refusée (HTTP ${response.status}).`, 'server');
  }
}
