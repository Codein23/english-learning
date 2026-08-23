/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL du Worker de synchronisation. Absente ⇒ synchronisation désactivée. */
  readonly VITE_SYNC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
