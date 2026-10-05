import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Without VITE_API_BASE_URL the SPA calls the relative /api, which only works when something in front of the SPA
  // forwards /api to the API (reverse proxy) — on a static host it would get the HTML fallback. Say so at build time.
  if (mode === 'production' && !loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE_URL) {
    console.warn('\n[vite] VITE_API_BASE_URL is not set: this build calls the relative "/api". Set it to the API origin unless a reverse proxy serves both.\n');
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      host: true,
      // Dev: with no VITE_API_BASE_URL the SPA calls the relative /api; forward it to the local API so the app and the
      // refresh cookie (host-only, Path=/api/auth) live on ONE origin. Dev only: no effect on the production build.
      proxy: {
        '/api': { target: process.env.VITE_DEV_API_TARGET || 'http://localhost:5000', changeOrigin: false },
      },
    },
  };
});
