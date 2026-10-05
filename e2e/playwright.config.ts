import { defineConfig } from '@playwright/test';

/**
 * Release E2E: the REAL frontend (production build served by `vite preview`), the REAL backend process, and the SQL
 * Server test database (backend/.env -> HotelBooking_DB0_Test). Nothing about the application is mocked.
 *   - NODE_ENV=test for the backend turns off ONLY the per-IP rate limiters (a suite that signs in dozens of times from
 *     one IP would otherwise hit the 10-logins-per-15-minutes limit), the request log and real SMTP.
 *   - The fixture server (backend package, tsx) seeds data, reads rows back, and stands in for VNPAY's refund API.
 *   - The hosted VNPAY payment page is the one external page we replace, inside the browser (see support/payment.ts).
 */
const API_PORT = 5100;
const WEB_PORT = 5174; // already in backend/.env CORS_ORIGIN
const FIXTURE_PORT = 5191;

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0, // a failure is a finding to triage, not something to re-run until green
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
        VNPAY_RETURN_URL: `http://localhost:${API_PORT}/api/payments/vnpay-return`,
        VNPAY_IPN_URL: `http://localhost:${API_PORT}/api/payments/vnpay-ipn`,
        VNPAY_REFUND_URL: `http://localhost:${FIXTURE_PORT}/vnpay/refund`,
      },
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run build && npx vite preview --port 5174 --strictPort',
      cwd: '../frontend',
      env: { VITE_API_BASE_URL: `http://localhost:${API_PORT}/api`, VITE_APP_ENV: 'production' },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
