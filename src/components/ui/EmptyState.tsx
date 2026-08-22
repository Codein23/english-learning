import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * État vide : enseigne l'écran et propose une action.
 * Jamais « Aucun résultat » tout seul.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface px-6 py-12 text-center">
      <Icon aria-hidden="true" className="size-6 text-muted" strokeWidth={1.75} />
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        <p className="mx-auto max-w-[46ch] text-sm text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
