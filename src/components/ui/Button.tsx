import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cx } from '@/lib/cx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-field)] font-medium ' +
  'transition-colors duration-150 ease-out select-none ' +
  'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50';

const variants: Record<Variant, string> = {
  // L'accent n'est pas dépensé sur les boutons : le primaire est l'encre elle-même.
  primary: 'bg-ink text-bg hover:bg-ink/90 active:bg-ink/80',
  secondary:
    'bg-surface text-ink border border-border hover:bg-surface-2 hover:border-border-strong active:bg-surface-2',
  ghost: 'text-ink hover:bg-surface-2 active:bg-surface-2',
  danger:
    'bg-transparent text-danger-text border border-danger/40 hover:bg-danger-subtle hover:border-danger active:bg-danger-subtle',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-base',
  lg: 'h-12 px-5 text-lg',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Libellé annoncé pendant le chargement — le bouton reste identifiable. */
  loadingLabel?: string;
  fullWidth?: boolean;
  children?: ReactNode;
}

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    loadingLabel = 'Chargement',
    fullWidth = false,
    className,
    children,
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 aria-hidden="true" className="size-4 animate-spin" strokeWidth={1.75} />
          <span>{loadingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
});

export type ButtonLinkProps = CommonProps & Omit<LinkProps, 'children'>;

/** Même vocabulaire visuel qu'un bouton, mais sémantiquement un lien. */
export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cx(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...props}
    >
      {children}
    </Link>
  );
}
