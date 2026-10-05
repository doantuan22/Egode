import { describe, it, expect, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { createTestAccount, deleteTestAccount } from '../../test/factories';
import { ACCOUNT_STATUS } from '../../common/constants/account-status';
import { getPrismaClient } from '../../config/prisma';
import { verifyPassword } from '../../common/utils/password';
import { signPasswordResetToken } from '../../common/utils/password-reset-token';

const createdAccountIds: number[] = [];

afterAll(async () => {
  await Promise.all(createdAccountIds.map((id) => deleteTestAccount(id)));
});

const validRegisterPayload = () => {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  return {
    TenDangNhap: `newuser_${suffix}`,
    Email: `newuser_${suffix}@example.com`,
    MatKhau: 'Test@12345',
    HoTen: 'New User',
    SoDienThoai: '0912345678',
    NgaySinh: '1998-05-20',
    GioiTinh: 'Nam',
  };
};

describe('POST /api/auth/register', () => {
  it('registers a valid customer account', async () => {
    const payload = validRegisterPayload();
    const res = await request(app).post('/api/auth/register').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.account.TenDangNhap).toBe(payload.TenDangNhap);
    expect(res.body.data.accessToken).toBeTypeOf('string');
    expect(res.body.data.account).not.toHaveProperty('MatKhau');
    createdAccountIds.push(res.body.data.account.MaTaiKhoan);
  });

  it('stores the password as a bcrypt hash, never plaintext', async () => {
    const payload = validRegisterPayload();
    const res = await request(app).post('/api/auth/register').send(payload);
    createdAccountIds.push(res.body.data.account.MaTaiKhoan);

    const prisma = getPrismaClient();
    const row = await prisma.tAI_KHOAN.findUnique({
      where: { MaTaiKhoan: res.body.data.account.MaTaiKhoan },
    });
    expect(row?.MatKhau).not.toBe(payload.MatKhau);
    expect(row?.MatKhau.startsWith('$2')).toBe(true); // bcrypt hash prefix
    expect(await verifyPassword(payload.MatKhau, row!.MatKhau)).toBe(true);
  });

  it('rejects a duplicate TenDangNhap', async () => {
    const payload = validRegisterPayload();
    const first = await request(app).post('/api/auth/register').send(payload);
    createdAccountIds.push(first.body.data.account.MaTaiKhoan);

    const second = await request(app)
      .post('/api/auth/register')
      .send({ ...payload, Email: `other_${Date.now()}@example.com` });

    expect(second.status).toBe(409);
    expect(second.body.success).toBe(false);
  });

  it('rejects a duplicate Email', async () => {
    const payload = validRegisterPayload();
    const first = await request(app).post('/api/auth/register').send(payload);
    createdAccountIds.push(first.body.data.account.MaTaiKhoan);

    const second = await request(app)
      .post('/api/auth/register')
      .send({ ...payload, TenDangNhap: `other_${Date.now()}` });

    expect(second.status).toBe(409);
  });

  it('rejects invalid input with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ Email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('DDI-01 (resolved): registers successfully WITHOUT NgaySinh/GioiTinh — they are not required', async () => {
    const payload = validRegisterPayload();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { NgaySinh: _ngaySinh, GioiTinh: _gioiTinh, ...minimalPayload } = payload;

    const res = await request(app).post('/api/auth/register').send(minimalPayload);

    expect(res.status).toBe(201);
    expect(res.body.data.account.NgaySinh).toBeNull();
    expect(res.body.data.account.GioiTinh).toBeNull();
    expect(res.body.data.account.AnhDaiDien).toBeNull();
    // SoDienThoai stays mandatory — confirms DDI-01 didn't loosen it too.
    expect(res.body.data.account.SoDienThoai).toBe(payload.SoDienThoai);
    createdAccountIds.push(res.body.data.account.MaTaiKhoan);
  });

  it('DDI-01 (resolved): still rejects registration missing the mandatory SoDienThoai', async () => {
    const payload = validRegisterPayload();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { SoDienThoai: _soDienThoai, ...payloadWithoutPhone } = payload;

    const res = await request(app).post('/api/auth/register').send(payloadWithoutPhone);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with valid credentials', async () => {
    const { account, plainPassword } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: account.Email, MatKhau: plainPassword });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTypeOf('string');
    expect(res.body.data.account.MaTaiKhoan).toBe(account.MaTaiKhoan);
    expect(res.headers['set-cookie']?.[0]).toContain('refresh_token=');
  });

  it('logs in with TenDangNhap as identifier too', async () => {
    const { account, plainPassword } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: account.TenDangNhap, MatKhau: plainPassword });

    expect(res.status).toBe(200);
  });

  it('rejects wrong password', async () => {
    const { account } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: account.Email, MatKhau: 'WrongPassword123' });

    expect(res.status).toBe(401);
  });

  it('rejects an unknown account', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'nobody@example.com', MatKhau: 'whatever123' });

    expect(res.status).toBe(401);
  });

  it('rejects a locked account even with the correct password', async () => {
    const { account, plainPassword } = await createTestAccount({ status: ACCOUNT_STATUS.LOCKED });
    createdAccountIds.push(account.MaTaiKhoan);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: account.Email, MatKhau: plainPassword });

    expect(res.status).toBe(403);
  });
});

describe('POST /api/auth/login — BUG-004: locked account is not a password oracle', () => {
  const login = (identifier: string, MatKhau: string) => request(app).post('/api/auth/login').send({ identifier, MatKhau });

  it('locked + correct password -> 403, locked + wrong password -> 403, with identical responses', async () => {
    const { account, plainPassword } = await createTestAccount({ status: ACCOUNT_STATUS.LOCKED });
    createdAccountIds.push(account.MaTaiKhoan);

    const correct = await login(account.Email, plainPassword);
    const wrong = await login(account.Email, 'WrongPassword123');

    expect(correct.status).toBe(403);
    expect(wrong.status).toBe(403);
    // An attacker must not be able to tell the two apart: same status, same body, no tokens/cookie.
    expect(wrong.body).toEqual(correct.body);
    expect(correct.body.success).toBe(false);
    expect(correct.body.message).toBe('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên');
    expect(correct.body.data).toBeUndefined();
    expect(correct.headers['set-cookie']).toBeUndefined();
    expect(wrong.headers['set-cookie']).toBeUndefined();
    // Neither the submitted password nor any hash may be echoed back.
    for (const res of [correct, wrong]) {
      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain(plainPassword);
      expect(raw).not.toContain('WrongPassword123');
      expect(raw).not.toContain('$2');
    }
  });

  it('locked account answers the same when addressed by TenDangNhap', async () => {
    const { account, plainPassword } = await createTestAccount({ status: ACCOUNT_STATUS.LOCKED });
    createdAccountIds.push(account.MaTaiKhoan);

    expect((await login(account.TenDangNhap, plainPassword)).status).toBe(403);
    expect((await login(account.TenDangNhap, 'WrongPassword123')).status).toBe(403);
  });

  it('active + correct password -> 200 with tokens', async () => {
    const { account, plainPassword } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);

    const res = await login(account.Email, plainPassword);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTypeOf('string');
    expect(res.body.data.account).not.toHaveProperty('MatKhau');
  });

  it('active + wrong password -> 401 with the generic message', async () => {
    const { account } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);

    const res = await login(account.Email, 'WrongPassword123');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Email/tên đăng nhập hoặc mật khẩu không đúng');
  });

  it('unknown account -> 401 with the same generic message as a wrong password', async () => {
    const { account } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);

    const unknown = await login('nobody@example.com', 'whatever123');
    const wrongPassword = await login(account.Email, 'WrongPassword123');
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(wrongPassword.body);
  });
});

describe('Authenticated route protection', () => {
  it('rejects a protected endpoint with no token', async () => {
    const res = await request(app).get('/api/profile/me');
    expect(res.status).toBe(401);
  });

  it('rejects a protected endpoint with an invalid token', async () => {
    const res = await request(app).get('/api/profile/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('allows a protected endpoint with a valid token', async () => {
    const { account, plainPassword } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ identifier: account.Email, MatKhau: plainPassword });
    const token = login.body.data.accessToken;

    const res = await request(app).get('/api/profile/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.MaTaiKhoan).toBe(account.MaTaiKhoan);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the refresh token cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']?.[0]).toContain('refresh_token=;');
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('always returns a generic success response (no account enumeration)', async () => {
    const known = await createTestAccount();
    createdAccountIds.push(known.account.MaTaiKhoan);

    const resKnown = await request(app)
      .post('/api/auth/forgot-password')
      .send({ Email: known.account.Email });
    const resUnknown = await request(app)
      .post('/api/auth/forgot-password')
      .send({ Email: 'definitely-not-registered@example.com' });

    expect(resKnown.status).toBe(200);
    expect(resUnknown.status).toBe(200);
    expect(resKnown.body.message).toBe(resUnknown.body.message);
    expect(resKnown.body).not.toHaveProperty('token');
    expect(resUnknown.body).not.toHaveProperty('token');
  });

  it('accepts a valid reset token, then rejects the old password and accepts the new one', async () => {
    const { account, plainPassword } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);
    const token = signPasswordResetToken(account.MaTaiKhoan, account.MatKhau);

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, MatKhauMoi: 'NewPassword@123' });
    expect(reset.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ identifier: account.Email, MatKhau: plainPassword });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ identifier: account.Email, MatKhau: 'NewPassword@123' });
    expect(newLogin.status).toBe(200);
  });
});

describe('POST /api/auth/change-password', () => {
  const NEW_PASSWORD = 'BrandNew@4567';

  const signIn = async () => {
    const { account, plainPassword } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ identifier: account.Email, MatKhau: plainPassword });
    return { account, plainPassword, token: login.body.data.accessToken as string };
  };

  const login = (identifier: string, MatKhau: string) =>
    request(app).post('/api/auth/login').send({ identifier, MatKhau });

  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ MatKhauCu: 'Test@12345', MatKhauMoi: NEW_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('changes the password when the current one is right, then only the new one logs in', async () => {
    const { account, plainPassword, token } = await signIn();
    const logSpies = (['log', 'info', 'warn', 'error'] as const).map((method) => vi.spyOn(console, method));

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ MatKhauCu: plainPassword, MatKhauMoi: NEW_PASSWORD });

    const logged = JSON.stringify(logSpies.flatMap((spy) => spy.mock.calls));
    logSpies.forEach((spy) => spy.mockRestore());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Neither the response nor anything logged may carry a password or hash.
    const stored = await getPrismaClient().tAI_KHOAN.findUnique({ where: { MaTaiKhoan: account.MaTaiKhoan } });
    const serializedResponse = JSON.stringify(res.body);
    for (const secret of [plainPassword, NEW_PASSWORD, stored!.MatKhau]) {
      expect(serializedResponse).not.toContain(secret);
      expect(logged).not.toContain(secret);
    }
    expect(res.body.data ?? {}).not.toHaveProperty('MatKhau');

    expect(stored!.MatKhau).not.toBe(NEW_PASSWORD);
    expect(await verifyPassword(NEW_PASSWORD, stored!.MatKhau)).toBe(true);

    expect((await login(account.Email, NEW_PASSWORD)).status).toBe(200);
    expect((await login(account.Email, plainPassword)).status).toBe(401);
  });

  it('rejects a wrong current password with 400 and leaves the password unchanged', async () => {
    const { account, plainPassword, token } = await signIn();

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ MatKhauCu: 'NotMyPassword@1', MatKhauMoi: NEW_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect((await login(account.Email, plainPassword)).status).toBe(200);
    expect((await login(account.Email, NEW_PASSWORD)).status).toBe(401);
  });

  it('rejects a new password equal to the current one', async () => {
    const { account, plainPassword, token } = await signIn();

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ MatKhauCu: plainPassword, MatKhauMoi: plainPassword });

    expect(res.status).toBe(400);
    expect((await login(account.Email, plainPassword)).status).toBe(200);
  });

  it.each([
    ['too short', 'Ab@1'],
    ['too long', 'a'.repeat(129)],
    ['missing', undefined],
  ])('rejects a new password that fails the policy (%s)', async (_label, MatKhauMoi) => {
    const { account, plainPassword, token } = await signIn();

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ MatKhauCu: plainPassword, MatKhauMoi });

    expect(res.status).toBe(400);
    expect((await login(account.Email, plainPassword)).status).toBe(200);
  });

  it('rejects a missing current password', async () => {
    const { token } = await signIn();

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ MatKhauMoi: NEW_PASSWORD });

    expect(res.status).toBe(400);
  });

  it('refuses a locked account even with the right current password', async () => {
    const { account, plainPassword, token } = await signIn();
    await getPrismaClient().tAI_KHOAN.update({
      where: { MaTaiKhoan: account.MaTaiKhoan },
      data: { TrangThai: ACCOUNT_STATUS.LOCKED },
    });

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ MatKhauCu: plainPassword, MatKhauMoi: NEW_PASSWORD });

    // The locked account is stopped by the authentication middleware itself (401), before the endpoint runs.
    expect(res.status).toBe(401);
    const stored = await getPrismaClient().tAI_KHOAN.findUniqueOrThrow({ where: { MaTaiKhoan: account.MaTaiKhoan } });
    expect(stored.TrangThai).toBe(ACCOUNT_STATUS.LOCKED);
  });

  it('does not let PATCH /profile/me change the password', async () => {
    const { account, plainPassword, token } = await signIn();

    await request(app)
      .patch('/api/profile/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ MatKhau: NEW_PASSWORD, HoTen: 'Still Same' });

    expect((await login(account.Email, plainPassword)).status).toBe(200);
    expect((await login(account.Email, NEW_PASSWORD)).status).toBe(401);
  });
});
