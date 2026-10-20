import { defineConfig } from '@playwright/test';

/** Cấu hình E2E chạy frontend, backend và CSDL test thật */
const API_PORT = 5100;
const WEB_PORT = 5174;
const FIXTURE_PORT = 5191;

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    channel: 'chrome',
    headless: true,
    locale: 'vi-VN',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npx tsx ../e2e/support/fixture-server.ts',
      cwd: '../backend',
      env: { E2E_FIXTURE_PORT: String(FIXTURE_PORT), NODE_ENV: 'test' },
      url: `http://localhost:${FIXTURE_PORT}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npx tsx src/server.ts',
      cwd: '../backend',
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        FRONTEND_URL: `http://localhost:${WEB_PORT}`,
        CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
        PAYMENT_PROVIDER: 'simulated',
      },
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run build -- --mode e2e && npx vite preview --mode e2e --port 5174 --strictPort',
      cwd: '../frontend',
      env: { VITE_API_BASE_URL: `http://localhost:${API_PORT}/api`, VITE_APP_ENV: 'production' },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
