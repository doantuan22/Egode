import { describe, it, expect, vi, afterAll, afterEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { createTestAccount, deleteTestAccount } from '../../test/factories';
import { getPrismaClient } from '../../config/prisma';
import { env } from '../../config/env';
import { refreshCookieBaseOptions } from '../../common/utils/auth-cookie';
import { REFRESH_TOKEN_COOKIE_NAME } from '../../common/utils/jwt';
import { ROLE_NAMES } from '../../common/constants/roles';
import { ACCOUNT_STATUS } from '../../common/constants/account-status';
import type { AuthService } from './auth.service';

/**
 * Bug #17 — the refresh cookie must reach the API in the deployment that is actually used.
 *  - SPA and API on the same site        → SameSite=Lax (default).
 *  - SPA and API on different sites      → SameSite=None; Secure, exact-origin credentialed CORS, Origin check on the
 *                                          two cookie-only endpoints.
 * The repo does not say which one production is (the SPA targets Cloudflare Pages; the API host is not stated), so the
 * policy is an explicit setting and production refuses to start without it.
 */
const ALLOWED_ORIGIN = env.CORS_ORIGIN.split(',')[0].trim().replace(/\/$/, '');
const FOREIGN_ORIGIN = 'https://evil.example';
const ids: number[] = [];
const prisma = () => getPrismaClient();

afterAll(async () => {
  await Promise.all(ids.map((id) => deleteTestAccount(id)));
});

const newAccount = async (role: string = ROLE_NAMES.CUSTOMER) => {
  const created = await createTestAccount({ role });
  ids.push(created.account.MaTaiKhoan);
  return { ...created, id: created.account.MaTaiKhoan };
};

const setCookieOf = (headers: Record<string, unknown>) => ((headers['set-cookie'] as string[] | undefined) ?? []).find((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE_NAME}=`));

describe('refreshCookieBaseOptions — the cookie policy for every environment', () => {
  it.each([
    { nodeEnv: 'development', sameSite: undefined, expected: { secure: false, sameSite: 'lax' } },
    { nodeEnv: 'test', sameSite: undefined, expected: { secure: false, sameSite: 'lax' } },
    { nodeEnv: 'production', sameSite: 'lax' as const, expected: { secure: true, sameSite: 'lax' } },
    { nodeEnv: 'production', sameSite: 'strict' as const, expected: { secure: true, sameSite: 'strict' } },
    { nodeEnv: 'production', sameSite: 'none' as const, expected: { secure: true, sameSite: 'none' } },
    // SameSite=None without Secure is rejected by every browser, so None forces Secure even in development.
    { nodeEnv: 'development', sameSite: 'none' as const, expected: { secure: true, sameSite: 'none' } },
  ])('NODE_ENV=$nodeEnv SameSite=$sameSite → $expected', ({ nodeEnv, sameSite, expected }) => {
    expect(refreshCookieBaseOptions(nodeEnv, sameSite)).toEqual({ httpOnly: true, path: '/api/auth', ...expected });
  });

  it('the cookie is always HttpOnly and scoped to /api/auth, whatever the policy', () => {
    for (const sameSite of ['lax', 'strict', 'none'] as const) {
      const options = refreshCookieBaseOptions('production', sameSite);
      expect(options.httpOnly).toBe(true);
      expect(options.path).toBe('/api/auth');
    }
  });
});

describe('SameSite=None end to end: login, refresh and logout all use the cross-site cookie (stub service, mocked env)', () => {
  afterEach(() => {
    vi.doUnmock('../../config/env');
    vi.resetModules();
  });

  it('set, rotate and clear agree: HttpOnly; Secure; SameSite=None; Path=/api/auth', async () => {
    vi.resetModules();
    vi.doMock('../../config/env', async () => {
      const actual = await vi.importActual<typeof import('../../config/env')>('../../config/env');
      return { ...actual, env: { ...actual.env, NODE_ENV: 'production', REFRESH_COOKIE_SAMESITE: 'none' } };
    });
    const { AuthController } = await import('./auth.controller');
    const controller = new AuthController({
      login: vi.fn().mockResolvedValue({ account: { MaTaiKhoan: 1 }, tokens: { accessToken: 'a.jwt', refreshToken: 'r.jwt' } }),
      refresh: vi.fn().mockResolvedValue({ accessToken: 'a2.jwt', refreshToken: 'r2.jwt' }),
    } as unknown as AuthService);
    const stub = express();
    stub.use(cookieParser());
    stub.post('/api/auth/login', controller.login);
    stub.post('/api/auth/refresh', controller.refresh);
    stub.post('/api/auth/logout', controller.logout);

    const login = setCookieOf((await request(stub).post('/api/auth/login').send({})).headers);
    const refresh = setCookieOf((await request(stub).post('/api/auth/refresh').set('Cookie', `${REFRESH_TOKEN_COOKIE_NAME}=r.jwt`)).headers);
    const logout = setCookieOf((await request(stub).post('/api/auth/logout')).headers);

    for (const header of [login, refresh, logout]) {
      expect(header).toMatch(/HttpOnly/i);
      expect(header).toMatch(/;\s*Secure/i);
      expect(header).toMatch(/SameSite=None/i);
      expect(header).toMatch(/Path=\/api\/auth/);
      expect(header).not.toMatch(/Domain=/i);
    }
    expect(logout).toMatch(/Expires=Thu, 01 Jan 1970/); // the clear carries the very same scope, so it removes the cookie
  });
});

describe('production environment validation (env.ts)', () => {
  const productionEnv: Record<string, string> = {
    NODE_ENV: 'production',
    PAYMENT_PROVIDER: 'vnpay',
    DATABASE_URL: 'sqlserver://db.internal:1433;database=HotelBooking;user=app;password=S3cret-Value-For-Test;encrypt=true',
    JWT_ACCESS_SECRET: 'a'.repeat(40),
    JWT_REFRESH_SECRET: 'b'.repeat(40),
    CLOUDINARY_CLOUD_NAME: 'cloud',
    CLOUDINARY_API_KEY: 'key',
    CLOUDINARY_API_SECRET: 'secret',
    VNPAY_TMN_CODE: 'TMN',
    VNPAY_HASH_SECRET: 'hash',
    VNPAY_PAYMENT_URL: 'https://pay.vnpayment.vn/paymentv2/vpcpay.html',
    VNPAY_REFUND_URL: 'https://pay.vnpayment.vn/merchant_webapi/api/transaction',
    VNPAY_RETURN_URL: 'https://api.test.invalid/api/payments/vnpay-return',
    VNPAY_IPN_URL: 'https://api.test.invalid/api/payments/vnpay-ipn',
    SMTP_HOST: 'smtp.test.invalid',
    SMTP_USER: 'mailer',
    SMTP_PASSWORD: 'mail-secret',
    SMTP_FROM: 'noreply@test.invalid',
    FRONTEND_URL: 'https://app.test.invalid',
    CORS_ORIGIN: 'https://app.test.invalid',
  };
  const originalEnv = { ...process.env };

  const loadEnv = async (overrides: Record<string, string | undefined>) => {
    vi.resetModules();
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv, productionEnv);
    delete process.env.REFRESH_COOKIE_SAMESITE;
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      return await import('../../config/env');
    } finally {
      errorSpy.mockRestore();
    }
  };

  afterEach(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    vi.resetModules();
  });

  it('production refuses to start when the cookie policy was not chosen', async () => {
    await expect(loadEnv({})).rejects.toThrow('Environment configuration validation failed');
  });

  it.each(['lax', 'none'])('production starts with REFRESH_COOKIE_SAMESITE=%s and exact HTTPS origins', async (policy) => {
    const { env: loaded } = await loadEnv({ REFRESH_COOKIE_SAMESITE: policy });
    expect(loaded.REFRESH_COOKIE_SAMESITE).toBe(policy);
    expect(loaded.CORS_ORIGIN).toBe('https://app.test.invalid');
  });

  it('an unknown policy is rejected', async () => {
    await expect(loadEnv({ REFRESH_COOKIE_SAMESITE: 'maybe' })).rejects.toThrow('Environment configuration validation failed');
  });

  it.each([
    { name: 'a wildcard CORS_ORIGIN', overrides: { CORS_ORIGIN: '*' } },
    { name: 'a wildcard inside a list', overrides: { CORS_ORIGIN: 'https://app.test.invalid,https://*.test.invalid' } },
    { name: 'a plain-HTTP CORS_ORIGIN', overrides: { CORS_ORIGIN: 'http://app.test.invalid' } },
  ])('production refuses $name (credentials need exact HTTPS origins)', async ({ overrides }) => {
    await expect(loadEnv({ REFRESH_COOKIE_SAMESITE: 'none', ...overrides })).rejects.toThrow('Environment configuration validation failed');
  });

  it('a wildcard origin is refused in development too — credentialed CORS can never use it', async () => {
    await expect(loadEnv({ NODE_ENV: 'development', CORS_ORIGIN: '*' })).rejects.toThrow('Environment configuration validation failed');
  });

  it('development needs no cookie setting and defaults to Lax', async () => {
    const { env: loaded } = await loadEnv({ NODE_ENV: 'development', CORS_ORIGIN: 'http://localhost:5173', FRONTEND_URL: 'http://localhost:5173' });
    expect(loaded.REFRESH_COOKIE_SAMESITE).toBeUndefined();
    expect(refreshCookieBaseOptions(loaded.NODE_ENV, loaded.REFRESH_COOKIE_SAMESITE).sameSite).toBe('lax');
  });
});

describe('CORS: exact origins with credentials, never a wildcard', () => {
  const preflight = (origin: string) =>
    request(app).options('/api/auth/refresh').set('Origin', origin).set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'content-type');

  it('the configured SPA origin gets that exact origin back with Allow-Credentials', async () => {
    const res = await preflight(ALLOWED_ORIGIN);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('a foreign origin gets no CORS grant at all, and never "*"', async () => {
    const res = await preflight(FOREIGN_ORIGIN);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    const real = await request(app).get('/api/health').set('Origin', FOREIGN_ORIGIN);
    expect(real.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('a trailing slash on the Origin does not open or close the door', async () => {
    expect((await preflight(`${ALLOWED_ORIGIN}/`)).headers['access-control-allow-origin']).toBe(`${ALLOWED_ORIGIN}/`);
  });
});

describe('the cookie-only endpoints (refresh, logout) check the request Origin', () => {
  it('refresh from a foreign origin is refused with 403 BEFORE the cookie is used, and the session is untouched', async () => {
    const user = await newAccount();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').set('Origin', ALLOWED_ORIGIN).send({ identifier: user.account.Email, MatKhau: user.plainPassword });

    const evil = await agent.post('/api/auth/refresh').set('Origin', FOREIGN_ORIGIN);
    expect(evil.status).toBe(403);
    expect(evil.body).toMatchObject({ success: false, code: 'FORBIDDEN' });
    expect(setCookieOf(evil.headers)).toBeUndefined(); // nothing rotated, nothing cleared

    expect((await agent.post('/api/auth/refresh').set('Origin', ALLOWED_ORIGIN)).status).toBe(200); // the session survived
  });

  it('logout from a foreign origin is refused and does not clear the cookie; from the SPA origin it does', async () => {
    const user = await newAccount();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').set('Origin', ALLOWED_ORIGIN).send({ identifier: user.account.Email, MatKhau: user.plainPassword });

    const evil = await agent.post('/api/auth/logout').set('Origin', FOREIGN_ORIGIN);
    expect(evil.status).toBe(403);
    expect(setCookieOf(evil.headers)).toBeUndefined();
    expect((await agent.post('/api/auth/refresh').set('Origin', ALLOWED_ORIGIN)).status).toBe(200);

    expect((await agent.post('/api/auth/logout').set('Origin', ALLOWED_ORIGIN)).status).toBe(200);
    expect((await agent.post('/api/auth/refresh').set('Origin', ALLOWED_ORIGIN)).status).toBe(401);
  });

  it('a request without Origin (curl, server-side) is not a cross-site browser request and still works', async () => {
    const user = await newAccount();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ identifier: user.account.Email, MatKhau: user.plainPassword });
    expect((await agent.post('/api/auth/refresh')).status).toBe(200);
    expect((await agent.post('/api/auth/logout')).status).toBe(200);
  });
});

describe('the whole session journey through the browser-style (Origin) path', () => {
  const asSpa = (agent: ReturnType<typeof request.agent>, path: string) => agent.post(path).set('Origin', ALLOWED_ORIGIN);
  const expired = (id: number) =>
    jwt.sign({ sub: String(id), role: ROLE_NAMES.CUSTOMER, typ: 'access' }, env.JWT_ACCESS_SECRET, { expiresIn: -60, algorithm: 'HS256', issuer: 'hotel-booking-api', audience: 'hotel-booking-web' });

  it('login → expired access token is 401 → refresh → new token works → logout → cookie gone', async () => {
    const user = await newAccount();
    const agent = request.agent(app);
    const login = await asSpa(agent, '/api/auth/login').send({ identifier: user.account.Email, MatKhau: user.plainPassword });
    expect(login.status).toBe(200);
    expect(setCookieOf(login.headers)).toMatch(/HttpOnly/i);

    expect((await request(app).get('/api/profile/me').set('Authorization', `Bearer ${expired(user.id)}`)).status).toBe(401);
    const refreshed = await asSpa(agent, '/api/auth/refresh');
    expect(refreshed.status).toBe(200);
    expect((await request(app).get('/api/profile/me').set('Authorization', `Bearer ${refreshed.body.data.accessToken}`)).status).toBe(200);

    const logout = await asSpa(agent, '/api/auth/logout');
    expect(logout.status).toBe(200);
    expect(setCookieOf(logout.headers)).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect((await asSpa(agent, '/api/auth/refresh')).status).toBe(401);
  });

  it('unauthorized requests: no token, garbage token, no refresh cookie → 401 with the error contract', async () => {
    expect((await request(app).get('/api/profile/me')).body).toMatchObject({ success: false, code: 'UNAUTHORIZED' });
    expect((await request(app).get('/api/profile/me').set('Authorization', 'Bearer not.a.jwt')).status).toBe(401);
    const noCookie = await request(app).post('/api/auth/refresh').set('Origin', ALLOWED_ORIGIN);
    expect(noCookie.status).toBe(401);
    expect(noCookie.body.code).toBe('UNAUTHORIZED');
  });

  it('account locked while signed in: refresh is refused and the dead cookie is cleared', async () => {
    const user = await newAccount();
    const agent = request.agent(app);
    await asSpa(agent, '/api/auth/login').send({ identifier: user.account.Email, MatKhau: user.plainPassword });
    await prisma().tAI_KHOAN.update({ where: { MaTaiKhoan: user.id }, data: { TrangThai: ACCOUNT_STATUS.LOCKED } });

    const refresh = await asSpa(agent, '/api/auth/refresh');
    expect(refresh.status).toBe(401);
    expect(setCookieOf(refresh.headers)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('role changed while signed in: the refreshed token carries the NEW role', async () => {
    const user = await newAccount(ROLE_NAMES.CUSTOMER);
    const partnerRole = await prisma().vAI_TRO.findFirstOrThrow({ where: { TenVaiTro: ROLE_NAMES.PARTNER } });
    const agent = request.agent(app);
    await asSpa(agent, '/api/auth/login').send({ identifier: user.account.Email, MatKhau: user.plainPassword });
    await prisma().tAI_KHOAN.update({ where: { MaTaiKhoan: user.id }, data: { MaVaiTro: partnerRole.MaVaiTro } });

    const refreshed = await asSpa(agent, '/api/auth/refresh');
    expect(refreshed.status).toBe(200);
    const payload = jwt.decode(refreshed.body.data.accessToken) as { role: string };
    expect(payload.role).toBe(ROLE_NAMES.PARTNER);
  });

  it('change password: this device gets a fresh cookie and keeps working; an older cookie is dead', async () => {
    const user = await newAccount();
    const device = request.agent(app);
    const other = request.agent(app);
    const login = await asSpa(device, '/api/auth/login').send({ identifier: user.account.Email, MatKhau: user.plainPassword });
    await asSpa(other, '/api/auth/login').send({ identifier: user.account.Email, MatKhau: user.plainPassword });

    const changed = await device.post('/api/auth/change-password').set('Origin', ALLOWED_ORIGIN).set('Authorization', `Bearer ${login.body.data.accessToken}`).send({ MatKhauCu: user.plainPassword, MatKhauMoi: 'Another-Passw0rd!' });
    expect(changed.status).toBe(200);
    expect(setCookieOf(changed.headers)).toMatch(/HttpOnly/i);
    expect((await asSpa(device, '/api/auth/refresh')).status).toBe(200);
    expect((await asSpa(other, '/api/auth/refresh')).status).toBe(401);
  });
});
