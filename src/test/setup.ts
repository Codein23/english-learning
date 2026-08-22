import '@testing-library/jest-dom/vitest';

// jsdom ne fournit pas matchMedia : le thème et prefers-reduced-motion en dépendent.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}
