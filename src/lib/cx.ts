type ClassValue = string | false | null | undefined;

/** Concaténation de classes, sans dépendance. */
export function cx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
