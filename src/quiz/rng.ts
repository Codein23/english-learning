/**
 * Générateur pseudo-aléatoire déterministe (mulberry32).
 * Le générateur de session doit être pur et reproductible : une même graine
 * produit exactement la même session, ce qui rend les tests fiables.
 */
export interface Rng {
  next: () => number;
  int: (maxExclusive: number) => number;
  pick: <T>(items: readonly T[]) => T | undefined;
  shuffle: <T>(items: readonly T[]) => T[];
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0 || 0x9e3779b9;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (maxExclusive: number): number =>
    maxExclusive <= 0 ? 0 : Math.floor(next() * maxExclusive);

  const pick = <T,>(items: readonly T[]): T | undefined => items[int(items.length)];

  const shuffle = <T,>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = int(i + 1);
      const a = copy[i] as T;
      const b = copy[j] as T;
      copy[i] = b;
      copy[j] = a;
    }
    return copy;
  };

  return { next, int, pick, shuffle };
}
