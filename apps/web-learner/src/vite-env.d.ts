/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Marketing / landing site (`apps/web`). Alias of `VITE_WEB_URL`. */
  readonly VITE_MARKETING_URL?: string;
  readonly VITE_WEB_URL?: string;
  /** Comma-separated admin console origins allowed for login `returnUrl` handoff. */
  readonly VITE_ADMIN_APP_URL?: string;
  readonly VITE_LEARNER_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
