import type { SessionSummary, VerbProgress } from '@/store/progress';

/**
 * Fusion de deux progressions, pure et commutative.
 *
 * Deux appareils peuvent travailler hors ligne en parallèle : à la reconnexion,
 * il faut réconcilier sans jamais perdre de travail.
 *
 * Règles, choisies pour être compréhensibles plutôt que subtiles :
 *  - **par verbe** : l'entrée retenue est celle vue le plus récemment
 *    (`lastSeen`), départagée par le nombre de tentatives. On ne mélange jamais
 *    deux entrées champ par champ — un `box` de l'un avec un `streak` de l'autre
 *    produirait un état incohérent ;
 *  - **compteurs** : `attempts` et `correct` prennent le maximum des deux côtés,
 *    car ils ne décroissent jamais ; une session travaillée hors ligne sur
 *    l'appareil « perdant » reste donc comptabilisée ;
 *  - **sessions** : union par identifiant, triée du plus récent au plus ancien ;
 *  - **favoris** : union. Conséquence assumée : retirer un favori sur un appareil
 *    ne le retire pas sur l'autre tant qu'ils n'ont pas resynchronisé dans ce
 *    sens. C'est le seul cas où la fusion privilégie la conservation.
 */

export interface SyncPayload {
  byVerb: Record<string, VerbProgress>;
  favorites: string[];
  sessions: SessionSummary[];
  /** Horodatage de l'appareil au moment de l'envoi, à titre informatif. */
  updatedAt: number;
}

const MAX_SESSIONS_KEPT = 200;

function pickEntry(a: VerbProgress, b: VerbProgress): VerbProgress {
  const seenA = a.lastSeen ?? 0;
  const seenB = b.lastSeen ?? 0;
  if (seenA !== seenB) return seenA > seenB ? a : b;
  return a.attempts >= b.attempts ? a : b;
}

export function mergeVerbProgress(a: VerbProgress, b: VerbProgress): VerbProgress {
  const winner = pickEntry(a, b);
  return {
    ...winner,
    attempts: Math.max(a.attempts, b.attempts),
    correct: Math.max(a.correct, b.correct),
    lastSeen: Math.max(a.lastSeen ?? 0, b.lastSeen ?? 0) || null,
  };
}

export function mergePayloads(local: SyncPayload, remote: SyncPayload): SyncPayload {
  const byVerb: Record<string, VerbProgress> = { ...remote.byVerb };

  for (const [verbId, entry] of Object.entries(local.byVerb)) {
    const other = byVerb[verbId];
    byVerb[verbId] = other ? mergeVerbProgress(entry, other) : entry;
  }

  const sessionsById = new Map<string, SessionSummary>();
  for (const session of [...remote.sessions, ...local.sessions]) {
    sessionsById.set(session.id, session);
  }
  const sessions = [...sessionsById.values()]
    .sort((first, second) => second.finishedAt - first.finishedAt)
    .slice(0, MAX_SESSIONS_KEPT);

  return {
    byVerb,
    favorites: [...new Set([...remote.favorites, ...local.favorites])].sort(),
    sessions,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  };
}

/** Contrôle de forme d'un payload déchiffré : une donnée corrompue ne doit rien casser. */
export function isSyncPayload(value: unknown): value is SyncPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<SyncPayload>;
  return (
    typeof candidate.byVerb === 'object' &&
    candidate.byVerb !== null &&
    Array.isArray(candidate.favorites) &&
    Array.isArray(candidate.sessions)
  );
}
