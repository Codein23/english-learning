/**
 * Worker de synchronisation — English Learning.
 *
 * Modèle de sécurité :
 *  - le client génère une clé de synchronisation (32 octets) qui ne quitte jamais
 *    l'appareil ; l'identifiant de compte et le jeton d'authentification en sont
 *    dérivés séparément, et le serveur ne stocke que le SHA-256 du jeton ;
 *  - la progression est chiffrée en AES-GCM côté client : le serveur stocke un
 *    blob opaque qu'il ne peut pas déchiffrer ;
 *  - aucune donnée personnelle n'est collectée : ni email, ni mot de passe, ni IP
 *    journalisée par nos soins.
 *
 * Le contrôle de concurrence est optimiste : chaque écriture annonce la version
 * qu'elle croit être la dernière, et le serveur refuse si elle a bougé (409).
 */

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
}

interface AccountRow {
  id: string;
  token_hash: string;
  version: number;
  blob: string | null;
  updated_at: number;
}

const MAX_BLOB_BYTES = 512 * 1024;

function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, init: ResponseInit, env: Env): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders(env),
      ...(init.headers ?? {}),
    },
  });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Comparaison à temps constant : évite de fuiter le jeton par la durée. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

function bearer(request: Request): string | null {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token === '' ? null : token;
}

async function authenticate(
  request: Request,
  env: Env,
  accountId: string,
): Promise<AccountRow | Response> {
  const token = bearer(request);
  if (!token) return json({ error: 'missing_token' }, { status: 401 }, env);

  const row = await env.DB.prepare(
    'SELECT id, token_hash, version, blob, updated_at FROM accounts WHERE id = ?',
  )
    .bind(accountId)
    .first<AccountRow>();

  // Même réponse pour un compte inconnu et un jeton faux : pas d'oracle d'existence.
  if (!row) return json({ error: 'unauthorized' }, { status: 401 }, env);
  if (!timingSafeEqual(row.token_hash, await sha256Hex(token))) {
    return json({ error: 'unauthorized' }, { status: 401 }, env);
  }
  return row;
}

const ID_PATTERN = /^[0-9a-f]{32}$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    if (url.pathname === '/health') {
      return json({ ok: true }, { status: 200 }, env);
    }

    // POST /account — enregistre un compte créé côté client.
    if (url.pathname === '/account' && request.method === 'POST') {
      let payload: { accountId?: unknown; token?: unknown };
      try {
        payload = (await request.json()) as typeof payload;
      } catch {
        return json({ error: 'invalid_json' }, { status: 400 }, env);
      }

      const accountId = typeof payload.accountId === 'string' ? payload.accountId : '';
      const token = typeof payload.token === 'string' ? payload.token : '';
      if (!ID_PATTERN.test(accountId) || token.length < 32) {
        return json({ error: 'invalid_account' }, { status: 400 }, env);
      }

      const now = Date.now();
      const existing = await env.DB.prepare('SELECT id FROM accounts WHERE id = ?')
        .bind(accountId)
        .first<{ id: string }>();
      if (existing) {
        // Collision d'identifiant : refus explicite plutôt qu'écrasement silencieux.
        return json({ error: 'already_exists' }, { status: 409 }, env);
      }

      await env.DB.prepare(
        'INSERT INTO accounts (id, token_hash, version, blob, created_at, updated_at) VALUES (?, ?, 0, NULL, ?, ?)',
      )
        .bind(accountId, await sha256Hex(token), now, now)
        .run();

      return json({ accountId, version: 0 }, { status: 201 }, env);
    }

    const syncMatch = /^\/sync\/([0-9a-f]{32})$/.exec(url.pathname);
    if (syncMatch) {
      const accountId = syncMatch[1] ?? '';
      const account = await authenticate(request, env, accountId);
      if (account instanceof Response) return account;

      if (request.method === 'GET') {
        return json(
          { version: account.version, blob: account.blob, updatedAt: account.updated_at },
          { status: 200 },
          env,
        );
      }

      if (request.method === 'PUT') {
        let payload: { baseVersion?: unknown; blob?: unknown };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return json({ error: 'invalid_json' }, { status: 400 }, env);
        }

        const baseVersion = typeof payload.baseVersion === 'number' ? payload.baseVersion : -1;
        const blob = typeof payload.blob === 'string' ? payload.blob : null;
        if (blob === null) return json({ error: 'invalid_blob' }, { status: 400 }, env);
        if (blob.length > MAX_BLOB_BYTES) {
          return json({ error: 'blob_too_large' }, { status: 413 }, env);
        }

        // Écriture concurrente : le client doit récupérer, fusionner, réessayer.
        if (baseVersion !== account.version) {
          return json(
            { error: 'version_conflict', version: account.version, blob: account.blob },
            { status: 409 },
            env,
          );
        }

        const nextVersion = account.version + 1;
        const now = Date.now();
        await env.DB.prepare(
          'UPDATE accounts SET blob = ?, version = ?, updated_at = ? WHERE id = ? AND version = ?',
        )
          .bind(blob, nextVersion, now, accountId, account.version)
          .run();

        return json({ version: nextVersion, updatedAt: now }, { status: 200 }, env);
      }

      if (request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM accounts WHERE id = ?').bind(accountId).run();
        return json({ deleted: true }, { status: 200 }, env);
      }

      return json({ error: 'method_not_allowed' }, { status: 405 }, env);
    }

    return json({ error: 'not_found' }, { status: 404 }, env);
  },
} satisfies ExportedHandler<Env>;
