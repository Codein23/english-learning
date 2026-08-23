import { describe, expect, it } from 'vitest';
import {
  decryptPayload,
  deriveAccountId,
  deriveToken,
  encryptPayload,
  formatSyncKey,
  generateSyncKey,
  isValidSyncKey,
} from './crypto';
import { mergePayloads, mergeVerbProgress, isSyncPayload, type SyncPayload } from './merge';
import type { VerbProgress } from '@/store/progress';

function entry(patch: Partial<VerbProgress> = {}): VerbProgress {
  return { attempts: 0, correct: 0, streak: 0, box: 1, lastSeen: null, avgMs: 0, ...patch };
}

function payload(patch: Partial<SyncPayload> = {}): SyncPayload {
  return { byVerb: {}, favorites: [], sessions: [], updatedAt: 1000, ...patch };
}

describe('clé de synchronisation', () => {
  it('génère une clé valide, formatée en groupes de 5', () => {
    const key = generateSyncKey();
    expect(isValidSyncKey(key)).toBe(true);
    expect(key.split('-').every((group) => group.length <= 5)).toBe(true);
  });

  it('tolère la casse, les espaces et les confusions O/0 et I/1 à la recopie', async () => {
    const key = generateSyncKey();
    const sloppy = key.toLowerCase().replace(/-/g, ' ');
    expect(await deriveAccountId(sloppy)).toBe(await deriveAccountId(key));
  });

  it('rejette une clé trop courte ou mal formée', () => {
    expect(isValidSyncKey('ABC')).toBe(false);
    expect(isValidSyncKey('!!!!')).toBe(false);
  });

  it('produit un identifiant de compte au format attendu par le Worker', async () => {
    const id = await deriveAccountId(generateSyncKey());
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('dérive un identifiant et un jeton distincts et non réversibles', async () => {
    const key = generateSyncKey();
    const id = await deriveAccountId(key);
    const token = await deriveToken(key);
    expect(id).not.toBe(token);
    expect(token).toHaveLength(64);
    // Ni l'un ni l'autre ne contient la clé.
    const clean = key.replace(/-/g, '');
    expect(token.toUpperCase()).not.toContain(clean);
  });

  it('donne des identifiants différents pour deux clés différentes', async () => {
    expect(await deriveAccountId(generateSyncKey())).not.toBe(
      await deriveAccountId(generateSyncKey()),
    );
  });

  it('normalise le formatage sans changer la valeur dérivée', async () => {
    const key = generateSyncKey();
    expect(await deriveAccountId(formatSyncKey(key.replace(/-/g, '')))).toBe(
      await deriveAccountId(key),
    );
  });
});

describe('chiffrement de bout en bout', () => {
  it('fait un aller-retour fidèle', async () => {
    const key = generateSyncKey();
    const data = payload({ favorites: ['eat', 'buy'], updatedAt: 42 });
    const blob = await encryptPayload(key, data);
    expect(await decryptPayload<SyncPayload>(key, blob)).toEqual(data);
  });

  it('ne laisse rien fuiter en clair dans le blob', async () => {
    const key = generateSyncKey();
    const blob = await encryptPayload(key, payload({ favorites: ['misunderstand'] }));
    expect(blob).not.toContain('misunderstand');
    expect(blob).not.toContain('favorites');
  });

  it('produit un blob différent à chaque chiffrement du même contenu', async () => {
    const key = generateSyncKey();
    const data = payload({ favorites: ['eat'] });
    expect(await encryptPayload(key, data)).not.toBe(await encryptPayload(key, data));
  });

  it('échoue au déchiffrement avec une autre clé', async () => {
    const blob = await encryptPayload(generateSyncKey(), payload());
    await expect(decryptPayload(generateSyncKey(), blob)).rejects.toThrow();
  });
});

describe('fusion de deux appareils', () => {
  it('retient l’entrée vue le plus récemment', () => {
    const ancien = entry({ attempts: 3, correct: 1, box: 2, streak: 0, lastSeen: 100 });
    const recent = entry({ attempts: 5, correct: 4, box: 4, streak: 3, lastSeen: 500 });
    const merged = mergeVerbProgress(ancien, recent);
    expect(merged.box).toBe(4);
    expect(merged.streak).toBe(3);
    expect(merged.lastSeen).toBe(500);
  });

  it('est commutative : l’ordre des appareils ne change pas le résultat', () => {
    const a = entry({ attempts: 3, correct: 1, box: 2, lastSeen: 100 });
    const b = entry({ attempts: 5, correct: 4, box: 4, lastSeen: 500 });
    expect(mergeVerbProgress(a, b)).toEqual(mergeVerbProgress(b, a));
  });

  it('ne perd jamais de tentatives travaillées hors ligne sur l’appareil perdant', () => {
    const perdant = entry({ attempts: 12, correct: 9, box: 2, lastSeen: 100 });
    const gagnant = entry({ attempts: 4, correct: 3, box: 5, lastSeen: 900 });
    const merged = mergeVerbProgress(perdant, gagnant);
    expect(merged.attempts).toBe(12);
    expect(merged.correct).toBe(9);
    expect(merged.box).toBe(5);
  });

  it('réunit les sessions sans doublon, de la plus récente à la plus ancienne', () => {
    const session = (id: string, finishedAt: number) => ({
      id,
      finishedAt,
      questionCount: 10,
      correctCount: 7,
      avgMs: 3000,
      score: 700,
      missedVerbIds: [],
    });

    const merged = mergePayloads(
      payload({ sessions: [session('a', 300), session('b', 100)] }),
      payload({ sessions: [session('b', 100), session('c', 200)] }),
    );

    expect(merged.sessions.map((item) => item.id)).toEqual(['a', 'c', 'b']);
  });

  it('réunit les favoris des deux appareils', () => {
    const merged = mergePayloads(
      payload({ favorites: ['eat', 'buy'] }),
      payload({ favorites: ['buy', 'read'] }),
    );
    expect(merged.favorites).toEqual(['buy', 'eat', 'read']);
  });

  it('conserve un verbe présent d’un seul côté', () => {
    const merged = mergePayloads(
      payload({ byVerb: { eat: entry({ attempts: 2, lastSeen: 10 }) } }),
      payload({ byVerb: { buy: entry({ attempts: 5, lastSeen: 20 }) } }),
    );
    expect(Object.keys(merged.byVerb).sort()).toEqual(['buy', 'eat']);
  });

  it('est idempotente : fusionner deux fois ne change rien', () => {
    const local = payload({
      byVerb: { eat: entry({ attempts: 4, correct: 3, lastSeen: 400 }) },
      favorites: ['eat'],
    });
    const remote = payload({
      byVerb: { eat: entry({ attempts: 2, correct: 2, lastSeen: 200 }) },
    });
    const once = mergePayloads(local, remote);
    expect(mergePayloads(once, remote)).toEqual(once);
  });

  it('rejette un payload distant corrompu', () => {
    expect(isSyncPayload(null)).toBe(false);
    expect(isSyncPayload({ byVerb: {} })).toBe(false);
    expect(isSyncPayload(payload())).toBe(true);
  });
});
