import { describe, it, expect, vi, afterAll, afterEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { CookieAccessInfo } from 'cookiejar';
import app from '../../app';
import { createTestAccount, deleteTestAccount } from '../../test/factories';
import { REFRESH_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_MAX_AGE_MS } from '../../common/utils/jwt';
import type { AuthService } from './auth.service';

/** Cookie refresh khi đặt và khi xóa phải dùng cùng thuộc tính */

interface ParsedCookie {
  name: string;
  value: string;
  attrs: Map<string, string | true>;
}

/** Trình phân tích Set-Cookie tối giản */
const parseSetCookie = (header: string): ParsedCookie => {
  const [pair, ...rest] = header.split(';').map((part) => part.trim());
  const eq = pair.indexOf('=');
  const attrs = new Map<string, string | true>();
  for (const part of rest) {
    const i = part.indexOf('=');
    if (i === -1) attrs.set(part.toLowerCase(), true);
    else attrs.set(part.slice(0, i).toLowerCase(), part.slice(i + 1));
  }
  return { name: pair.slice(0, eq), value: pair.slice(eq + 1), attrs };
};

const refreshCookieFrom = (headers: Record<string, unknown>): ParsedCookie => {
  const all = (headers['set-cookie'] as string[] | undefined) ?? [];
  const found = all.map(parseSetCookie).find((c) => c.name === REFRESH_TOKEN_COOKIE_NAME);
  if (!found) throw new Error(`no ${REFRESH_TOKEN_COOKIE_NAME} Set-Cookie in response`);
  return found;
};

/** Các thuộc tính xác định cookie */
const SCOPE_ATTRS = ['path', 'domain', 'httponly', 'secure', 'samesite'] as const;
const scopeOf = (cookie: ParsedCookie) => Object.fromEntries(SCOPE_ATTRS.map((key) => [key, cookie.attrs.get(key)]));

const EPOCH = 'Thu, 01 Jan 1970 00:00:00 GMT';
const MAX_AGE_SECONDS = String(REFRESH_TOKEN_COOKIE_MAX_AGE_MS / 1000);

const createdAccountIds: number[] = [];
afterAll(async () => {
  await Promise.all(createdAccountIds.map((id) => deleteTestAccount(id)));
});

const newAccount = async () => {
  const created = await createTestAccount();
  createdAccountIds.push(created.account.MaTaiKhoan);
  return created;
};

describe('refresh_token cookie — real app, test/dev environment (not production)', () => {
  it('login sets the cookie HttpOnly, SameSite=Lax, Path=/api/auth, without Secure, with the 7-day max-age', async () => {
    const { account, plainPassword } = await newAccount();
    const res = await request(app).post('/api/auth/login').send({ identifier: account.Email, MatKhau: plainPassword });

    const set = refreshCookieFrom(res.headers);
    expect(set.value).not.toBe('');
    expect(set.attrs.get('httponly')).toBe(true);
    expect(set.attrs.get('samesite')).toBe('Lax');
    expect(set.attrs.get('path')).toBe('/api/auth');
    expect(set.attrs.has('secure')).toBe(false);
    expect(set.attrs.has('domain')).toBe(false);
    expect(set.attrs.get('max-age')).toBe(MAX_AGE_SECONDS);
  });

  it('logout clears the cookie with the SAME scope/security attributes login used, and without the refresh max-age', async () => {
    const { account, plainPassword } = await newAccount();
    const login = await request(app).post('/api/auth/login').send({ identifier: account.Email, MatKhau: plainPassword });
    const logout = await request(app).post('/api/auth/logout');

    const set = refreshCookieFrom(login.headers);
    const clear = refreshCookieFrom(logout.headers);
    expect(clear.value).toBe('');
    expect(clear.attrs.get('expires')).toBe(EPOCH);
    expect(clear.attrs.get('max-age')).not.toBe(MAX_AGE_SECONDS);
    expect(clear.attrs.get('httponly')).toBe(true);
    expect(clear.attrs.get('samesite')).toBe('Lax');
    expect(clear.attrs.get('path')).toBe('/api/auth');
    expect(scopeOf(clear)).toEqual(scopeOf(set));
  });

  it('register and refresh set the cookie with the same attributes as login', async () => {
    const { account, plainPassword } = await newAccount();
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ identifier: account.Email, MatKhau: plainPassword });
    const refresh = await agent.post('/api/auth/refresh');

    expect(refresh.status).toBe(200);
    const loginCookie = refreshCookieFrom(login.headers);
    const refreshCookie = refreshCookieFrom(refresh.headers);
    expect(scopeOf(refreshCookie)).toEqual(scopeOf(loginCookie));
    expect(refreshCookie.attrs.get('max-age')).toBe(MAX_AGE_SECONDS);

    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const reg = await request(app).post('/api/auth/register').send({
      TenDangNhap: `cookie_${suffix}`,
      Email: `cookie_${suffix}@example.com`,
      MatKhau: 'Test@12345',
      HoTen: 'Cookie User',
      SoDienThoai: '0912345678',
    });
    expect(reg.status).toBe(201);
    createdAccountIds.push(reg.body.data.account.MaTaiKhoan);
    expect(scopeOf(refreshCookieFrom(reg.headers))).toEqual(scopeOf(loginCookie));
  });
});

describe('refresh_token cookie — logout lifecycle with a real cookie jar', () => {
  it('login stores the cookie, refresh works, logout removes it from the jar, and refresh afterwards is refused', async () => {
    const { account, plainPassword } = await newAccount();
    const agent = request.agent(app);
    const stored = () =>
      (agent as unknown as { jar: { getCookies(access: unknown): Array<{ name: string }> } }).jar
        .getCookies(new CookieAccessInfo('127.0.0.1', '/api/auth', false))
        .map((c) => c.name);

    expect((await agent.post('/api/auth/login').send({ identifier: account.Email, MatKhau: plainPassword })).status).toBe(200);
    expect(stored()).toContain(REFRESH_TOKEN_COOKIE_NAME);
    expect((await agent.post('/api/auth/refresh')).status).toBe(200);

    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(200);
    expect(logout.body).toEqual({ success: true, message: 'Đăng xuất thành công' });
    expect(stored()).not.toContain(REFRESH_TOKEN_COOKIE_NAME);

    const afterLogout = await agent.post('/api/auth/refresh');
    expect(afterLogout.status).toBe(401);
    expect(afterLogout.body.message).toBe('Không tìm thấy refresh token');
  });

  it('logout without any cookie does not crash and still answers the same contract', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Đăng xuất thành công' });
    expect(refreshCookieFrom(res.headers).attrs.get('expires')).toBe(EPOCH);
  });

  it('the cookie is also cleared in the jar when logging out twice in a row', async () => {
    const { account, plainPassword } = await newAccount();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ identifier: account.Email, MatKhau: plainPassword });
    expect((await agent.post('/api/auth/logout')).status).toBe(200);
    expect((await agent.post('/api/auth/logout')).status).toBe(200);
    expect((await agent.post('/api/auth/refresh')).status).toBe(401);
  });
});

/** Nạp lại controller với env giả để kiểm tra môi trường khác */
const loadControllerFor = async (nodeEnv: 'development' | 'production') => {
  vi.resetModules();
  vi.doMock('../../config/env', async () => {
    const actual = await vi.importActual<typeof import('../../config/env')>('../../config/env');
    return { ...actual, env: { ...actual.env, NODE_ENV: nodeEnv } };
  });
  const { AuthController } = await import('./auth.controller');
  const stubService = {
    login: vi.fn().mockResolvedValue({
      account: { MaTaiKhoan: 1 },
      tokens: { accessToken: 'access.jwt', refreshToken: 'refresh.jwt' },
    }),
    refresh: vi.fn().mockResolvedValue({ accessToken: 'access2.jwt', refreshToken: 'refresh2.jwt' }),
  } as unknown as AuthService;
  const controller = new AuthController(stubService);
  const stubApp = express();
  stubApp.use(cookieParser());
  stubApp.post('/api/auth/login', controller.login);
  stubApp.post('/api/auth/refresh', controller.refresh);
  stubApp.post('/api/auth/logout', controller.logout);
  return stubApp;
};

describe.each([
  { nodeEnv: 'development' as const, secure: false },
  { nodeEnv: 'production' as const, secure: true },
])('refresh_token cookie — NODE_ENV=$nodeEnv (Secure=$secure)', ({ nodeEnv, secure }) => {
  afterEach(() => {
    vi.doUnmock('../../config/env');
    vi.resetModules();
  });

  it('set (login/refresh) and clear (logout) agree on every scope and security attribute', async () => {
    const stubApp = await loadControllerFor(nodeEnv);

    const login = await request(stubApp).post('/api/auth/login').send({});
    const refresh = await request(stubApp).post('/api/auth/refresh').set('Cookie', `${REFRESH_TOKEN_COOKIE_NAME}=refresh.jwt`);
    const logout = await request(stubApp).post('/api/auth/logout');

    const set = refreshCookieFrom(login.headers);
    const rotated = refreshCookieFrom(refresh.headers);
    const clear = refreshCookieFrom(logout.headers);

    for (const cookie of [set, rotated, clear]) {
      expect(cookie.attrs.get('httponly')).toBe(true);
      expect(cookie.attrs.get('samesite')).toBe('Lax');
      expect(cookie.attrs.get('path')).toBe('/api/auth');
      expect(cookie.attrs.has('secure')).toBe(secure);
    }
    expect(set.attrs.get('max-age')).toBe(MAX_AGE_SECONDS);
    expect(clear.value).toBe('');
    expect(clear.attrs.get('expires')).toBe(EPOCH);
    expect(clear.attrs.get('max-age')).not.toBe(MAX_AGE_SECONDS);
    expect(scopeOf(clear)).toEqual(scopeOf(set));
    expect(scopeOf(rotated)).toEqual(scopeOf(set));
  });
});
