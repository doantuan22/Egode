import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { validateProductionApiBaseUrl } from './build/production-api-url.ts';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), 'VITE_');
  const apiBaseUrl = process.env.VITE_API_BASE_URL ?? fileEnv.VITE_API_BASE_URL;

  // Cloudflare Pages is a static host in this architecture, so a relative /api silently resolves to its HTML fallback.
  // Require an explicit API URL at build time to prevent shipping an unusable artifact.
  if (mode === 'production') {
    validateProductionApiBaseUrl(apiBaseUrl);
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
