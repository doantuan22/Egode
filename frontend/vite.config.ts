import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { validateProductionApiBaseUrl } from './build/production-api-url.ts';

// Cấu hình Vite
export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), 'VITE_');
  const apiBaseUrl = process.env.VITE_API_BASE_URL ?? fileEnv.VITE_API_BASE_URL;

  // Yêu cầu URL API khi build vì host tĩnh không có /api
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
      // Chuyển /api tới API local khi chạy dev
      proxy: {
        '/api': { target: process.env.VITE_DEV_API_TARGET || 'http://localhost:5000', changeOrigin: false },
      },
    },
  };
});
