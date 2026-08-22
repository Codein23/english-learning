import { NavLink, Outlet, ScrollRestoration } from 'react-router-dom';
import {
  BarChart3,
  Dumbbell,
  Home,
  Settings,
  Table2,
  type LucideIcon,
} from 'lucide-react';
import { useThemeSync } from '@/lib/useThemeSync';
import { cx } from '@/lib/cx';

interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

/** Cinq entrées maximum : contrainte de la tab bar mobile. */
const NAV: NavEntry[] = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/verbs', label: 'Verbes', icon: Table2 },
  { to: '/quiz', label: 'Entraînement', icon: Dumbbell },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
  { to: '/settings', label: 'Réglages', icon: Settings },
];

export function AppShell() {
  useThemeSync();

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[var(--z-toast)] focus:rounded-[var(--radius-field)] focus:bg-ink focus:px-4 focus:py-2 focus:text-bg"
      >
        Aller au contenu
      </a>

      <div className="lg:flex">
        <Sidebar />

        <div className="min-w-0 flex-1">
          <main
            id="main"
            tabIndex={-1}
            className="mx-auto w-full max-w-[var(--container-content)] px-4 pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-10 lg:pb-16"
          >
            <Outlet />
          </main>
        </div>
      </div>

      <TabBar />
      <ScrollRestoration />
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 lg:flex">
      <Wordmark />

      <nav aria-label="Navigation principale" className="mt-8 flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end ?? false}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-[var(--radius-field)] px-3 py-2 text-sm font-medium transition-colors duration-150 ease-out',
                isActive
                  ? 'bg-accent-subtle text-accent-text'
                  : 'text-muted hover:bg-surface-2 hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} />
                <span>{label}</span>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="ml-auto h-4 w-0.5 rounded-full bg-accent-text"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-2 pt-8 text-2xs text-muted">
        <p>
          Sources : tableau pédagogique <em>by Huito</em> et liste de fréquence{' '}
          <span className="whitespace-nowrap">englishpage.com</span>. Usage strictement
          personnel.
        </p>
        <NavLink to="/credits" className="underline underline-offset-2 hover:text-ink">
          Crédits audio
        </NavLink>
      </div>
    </aside>
  );
}

function TabBar() {
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-[var(--z-tabbar)] border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-float)] lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end ?? false}
              className={({ isActive }) =>
                cx(
                  'flex min-h-[3.5rem] flex-col items-center justify-center gap-1 px-1 py-2 text-2xs font-medium transition-colors duration-150 ease-out',
                  isActive ? 'text-accent-text' : 'text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden="true"
                    className={cx(
                      'h-0.5 w-6 rounded-full transition-colors duration-150 ease-out',
                      isActive ? 'bg-accent-text' : 'bg-transparent',
                    )}
                  />
                  <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
                  <span className="leading-none">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Wordmark() {
  return (
    <div className="px-1">
      <p className="text-xs font-medium tracking-wide text-muted">English Learning</p>
      <p className="text-lg font-bold">Verbes irréguliers</p>
    </div>
  );
}
