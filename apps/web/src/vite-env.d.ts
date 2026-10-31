/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LEARNER_APP_URL?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_PLUS_IMPORT_DISCOUNT_LIVE?: string;
  readonly VITE_PLUS_CHECKOUT_LIVE?: string;
  readonly VITE_BUILD_COMMIT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
