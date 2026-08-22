const percentFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  maximumFractionDigits: 0,
});

const secondsFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Pourcentage arrondi, jamais à l'avantage de l'utilisateur : `Math.floor`. */
export function formatPercent(ratio: number | null): string {
  if (ratio === null) return '—';
  return percentFormatter.format(Math.floor(ratio * 100) / 100);
}

export function formatSeconds(ms: number | null): string {
  if (ms === null || ms <= 0) return '—';
  return `${secondsFormatter.format(ms / 1000)} s`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}

/** « 2 jours », « 1 jour », « aujourd'hui » — pour la série et la dernière visite. */
export function formatDayDelta(timestamp: number | null, now = Date.now()): string {
  if (timestamp === null) return 'jamais';
  const days = Math.floor((now - timestamp) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  return `il y a ${formatCount(days)} jours`;
}

/** Liste de variantes : « got ou gotten ». */
export function formatVariants(variants: readonly string[]): string {
  if (variants.length <= 1) return variants[0] ?? '';
  return `${variants.slice(0, -1).join(', ')} ou ${variants[variants.length - 1] ?? ''}`;
}
