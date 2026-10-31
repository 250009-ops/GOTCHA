/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LEARNER_APP_URL?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_SHOW_PRICING?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
