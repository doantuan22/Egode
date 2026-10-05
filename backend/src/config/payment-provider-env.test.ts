import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * PAYMENT_PROVIDER in env.ts: development defaults to the simulation, production must choose, and the VNPAY
 * credentials are only demanded when the real gateway is chosen.
 */
const base: Record<string, string> = {
  NODE_ENV: 'production',
  DATABASE_URL: 'sqlserver://db.internal:1433;database=HotelBooking;user=app;password=S3cret-Value-For-Test;encrypt=true',
  JWT_ACCESS_SECRET: 'a'.repeat(40),
  JWT_REFRESH_SECRET: 'b'.repeat(40),
  CLOUDINARY_CLOUD_NAME: 'cloud',
  CLOUDINARY_API_KEY: 'key',
  CLOUDINARY_API_SECRET: 'secret',
  SMTP_HOST: 'smtp.test.invalid',
  SMTP_USER: 'mailer',
  SMTP_PASSWORD: 'mail-secret',
  SMTP_FROM: 'noreply@test.invalid',
  FRONTEND_URL: 'https://app.test.invalid',
  CORS_ORIGIN: 'https://app.test.invalid',
  REFRESH_COOKIE_SAMESITE: 'lax',
};
const vnpayComplete: Record<string, string> = {
  VNPAY_TMN_CODE: 'TMN',
  VNPAY_HASH_SECRET: 'hash-secret-value',
  VNPAY_PAYMENT_URL: 'https://pay.vnpayment.vn/paymentv2/vpcpay.html',
  VNPAY_REFUND_URL: 'https://pay.vnpayment.vn/merchant_webapi/api/transaction',
  VNPAY_RETURN_URL: 'https://api.test.invalid/api/payments/vnpay-return',
  VNPAY_IPN_URL: 'https://api.test.invalid/api/payments/vnpay-ipn',
};
const originalEnv = { ...process.env };

const loadEnv = async (overrides: Record<string, string | undefined>) => {
  vi.resetModules();
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnv, base);
  // blank (not deleted): env.ts loads backend/.env for any variable that is absent, and a developer's .env has values
  process.env.VNPAY_TMN_CODE = '';
  process.env.VNPAY_HASH_SECRET = '';
  process.env.PAYMENT_PROVIDER = '';
  // the developer's own .env must not leak real VNPAY / provider values into these cases
  process.env.VNPAY_PAYMENT_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  process.env.VNPAY_REFUND_URL = 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction';
  process.env.VNPAY_RETURN_URL = 'http://localhost:5000/api/payments/vnpay-return';
  process.env.VNPAY_IPN_URL = 'http://localhost:5000/api/payments/vnpay-ipn';
  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value ?? '';
  }
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    return await import('./env');
  } finally {
    errorSpy.mockRestore();
  }
};

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnv);
  vi.resetModules();
});

describe('PAYMENT_PROVIDER', () => {
  it('production refuses to start without an explicit choice (simulating payments by accident would confirm unpaid bookings)', async () => {
    await expect(loadEnv({})).rejects.toThrow('Environment configuration validation failed');
  });

  it('production accepts "simulated" without any VNPAY value (no gateway is involved)', async () => {
    const { env } = await loadEnv({ PAYMENT_PROVIDER: 'simulated' });
    expect(env.PAYMENT_PROVIDER).toBe('simulated');
  });

  it('production with "vnpay" needs the merchant code and secret, https return/IPN URLs, and non-sandbox endpoints', async () => {
    await expect(loadEnv({ PAYMENT_PROVIDER: 'vnpay' })).rejects.toThrow('Environment configuration validation failed'); // nothing configured
    await expect(loadEnv({ PAYMENT_PROVIDER: 'vnpay', ...vnpayComplete, VNPAY_TMN_CODE: undefined })).rejects.toThrow('Environment configuration validation failed');
    await expect(loadEnv({ PAYMENT_PROVIDER: 'vnpay', ...vnpayComplete, VNPAY_RETURN_URL: 'http://api.test.invalid/return' })).rejects.toThrow('Environment configuration validation failed');
    await expect(loadEnv({ PAYMENT_PROVIDER: 'vnpay', ...vnpayComplete, VNPAY_PAYMENT_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html' })).rejects.toThrow('Environment configuration validation failed');
    const { env } = await loadEnv({ PAYMENT_PROVIDER: 'vnpay', ...vnpayComplete });
    expect(env.PAYMENT_PROVIDER).toBe('vnpay');
  });

  it('an unknown value is rejected', async () => {
    await expect(loadEnv({ PAYMENT_PROVIDER: 'paypal' })).rejects.toThrow('Environment configuration validation failed');
  });

  it('development needs nothing: the provider is unset and resolves to the simulation', async () => {
    const { env } = await loadEnv({ NODE_ENV: 'development', FRONTEND_URL: 'http://localhost:5173', CORS_ORIGIN: 'http://localhost:5173' });
    expect(env.PAYMENT_PROVIDER).toBeUndefined();
    const { getPaymentProvider } = await import('../modules/payments/payment-provider');
    expect(getPaymentProvider()).toBe('simulated');
  });
});
