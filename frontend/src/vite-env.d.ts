/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_ENV: string;
  /** Minimum time (ms) the simulated payment / refund animation stays on screen. Default 2600. */
  readonly VITE_SIMULATION_DELAY_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
