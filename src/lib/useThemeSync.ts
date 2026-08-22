import { useEffect } from 'react';
import { resolveTheme, useSettings } from '@/store/settings';

/**
 * Applique le thème effectif sur `<html data-theme>` et suit les changements
 * système tant que la préférence est « system ». Le premier paint est déjà
 * traité par le script inline de `index.html` : ici on ne fait que suivre.
 */
export function useThemeSync(): void {
  const theme = useSettings((state) => state.theme);

  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(theme);
    };
    apply();

    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
