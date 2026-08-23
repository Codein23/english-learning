import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptPayload, deriveAccountId, generateSyncKey } from './crypto';
import type { SyncPayload } from './merge';

/**
 * Le client est testé contre un faux serveur qui reproduit le contrat du Worker :
 * versions optimistes, 409 sur écriture concurrente, 401 sur jeton inconnu.
 */

const KEY = generateSyncKey();

function payload(patch: Partial<SyncPayload> = {}): SyncPayload {
  return { byVerb: {}, favorites: [], sessions: [], updatedAt: 1, ...patch };
}

interface FakeServer {
  version: number;
  blob: string | null;
  putCalls: number;
  /** Simule un autre appareil qui écrit juste avant nous. */
  bumpOnNextPut: boolean;
}

let server: FakeServer;

/** Réponse JSON immédiate : le faux serveur n'a rien d'asynchrone à attendre. */
const reply = (body: unknown, status: number): Promise<Response> =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  vi.stubEnv('VITE_SYNC_URL', 'https://sync.test');
  server = { version: 0, blob: null, putCalls: 0, bumpOnNextPut: false };

  vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const method = init?.method ?? 'GET';

    if (url.pathname === '/account' && method === 'POST') {
      return reply({ version: 0 }, 201);
    }

    if (url.pathname.startsWith('/sync/')) {
      if (init?.headers && !('Authorization' in (init.headers as Record<string, string>))) {
        return reply({ error: 'unauthorized' }, 401);
      }

      if (method === 'GET') {
        return reply({ version: server.version, blob: server.blob }, 200);
      }

      if (method === 'PUT') {
        server.putCalls += 1;
        const body = JSON.parse(
          typeof init?.body === 'string' ? init.body : '{}',
        ) as { baseVersion: number; blob: string };

        if (server.bumpOnNextPut) {
          server.bumpOnNextPut = false;
          server.version += 1;
          return reply({ error: 'version_conflict', version: server.version }, 409);
        }
        if (body.baseVersion !== server.version) {
          return reply({ error: 'version_conflict' }, 409);
        }

        server.version += 1;
        server.blob = body.blob;
        return reply({ version: server.version }, 200);
      }

      if (method === 'DELETE') {
        return reply({ deleted: true }, 200);
      }
    }

    return reply({ error: 'not_found' }, 404);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadClient() {
  return import('./client');
}

describe('client de synchronisation', () => {
  it('pousse la progression locale sur un compte vide', async () => {
    const { synchronize } = await loadClient();
    const result = await synchronize(KEY, payload({ favorites: ['eat'] }));
    expect(result.version).toBe(1);
    expect(result.merged.favorites).toEqual(['eat']);
    expect(server.blob).not.toBeNull();
  });

  it('fusionne avec ce qui existe déjà côté serveur', async () => {
    const { synchronize } = await loadClient();
    server.blob = await encryptPayload(KEY, payload({ favorites: ['read'] }));
    server.version = 3;

    const result = await synchronize(KEY, payload({ favorites: ['eat'] }));
    expect(result.merged.favorites).toEqual(['eat', 'read']);
    expect(result.version).toBe(4);
  });

  it('rejoue le cycle quand un autre appareil écrit entre-temps', async () => {
    const { synchronize } = await loadClient();
    server.bumpOnNextPut = true;

    const result = await synchronize(KEY, payload({ favorites: ['eat'] }));
    expect(server.putCalls).toBe(2);
    expect(result.version).toBeGreaterThan(0);
  });

  it('abandonne proprement après trois conflits d’affilée', async () => {
    const { synchronize, SyncError } = await loadClient();
    vi.stubGlobal('fetch', (_input: string, init?: RequestInit) =>
      (init?.method ?? 'GET') === 'GET'
        ? reply({ version: 0, blob: null }, 200)
        : reply({ error: 'version_conflict' }, 409),
    );

    await expect(synchronize(KEY, payload())).rejects.toBeInstanceOf(SyncError);
  });

  it('signale une clé invalide plutôt que de planter', async () => {
    const { pull, SyncError } = await loadClient();
    vi.stubGlobal('fetch', () => reply({ error: 'unauthorized' }, 401));

    await expect(pull(KEY)).rejects.toMatchObject({ code: 'unauthorized' });
    await expect(pull(KEY)).rejects.toBeInstanceOf(SyncError);
  });

  it('signale une panne réseau sans perdre les données locales', async () => {
    const { synchronize } = await loadClient();
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('network down')));

    await expect(synchronize(KEY, payload({ favorites: ['eat'] }))).rejects.toMatchObject({
      code: 'network',
    });
  });

  it('détecte des données distantes illisibles', async () => {
    const { pull } = await loadClient();
    server.blob = 'not-a-valid-blob';
    await expect(pull(KEY)).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('cible bien le compte dérivé de la clé', async () => {
    const { pull } = await loadClient();
    const seen: string[] = [];
    vi.stubGlobal('fetch', (input: string) => {
      seen.push(new URL(input).pathname);
      return reply({ version: 0, blob: null }, 200);
    });

    await pull(KEY);
    expect(seen[0]).toBe(`/sync/${await deriveAccountId(KEY)}`);
  });

  it('refuse de fonctionner si aucune URL de synchronisation n’est configurée', async () => {
    vi.stubEnv('VITE_SYNC_URL', '');
    vi.resetModules();
    const { synchronize } = await loadClient();
    await expect(synchronize(KEY, payload())).rejects.toMatchObject({ code: 'not_configured' });
  });
});
