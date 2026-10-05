import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { createTestAccount, deleteTestAccount, getRoleId } from '../test/factories';
import { getPrismaClient } from '../config/prisma';
import { ROLE_NAMES } from '../common/constants/roles';
import { ACCOUNT_STATUS } from '../common/constants/account-status';
import { signAccessToken } from '../common/utils/jwt';
import { signPasswordResetToken } from '../common/utils/password-reset-token';
import { AuthService } from '../modules/auth/auth.service';
import type { EmailService } from '../modules/email/email.service';

/**
 * Bug #6 — an access token only identifies the caller; whether the account is locked and which role it
 * holds are read from the database on every request.
 */
const ids: number[] = [];
const login = async (email: string, password: string) =>
  (await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password })).body.data.accessToken as string;
const prisma = () => getPrismaClient();

const newAccount = async (role: (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES]) => {
  const created = await createTestAccount({ role });
  ids.push(created.account.MaTaiKhoan);
  return { ...created, id: created.account.MaTaiKhoan, token: await login(created.account.Email, created.plainPassword) };
};
const setStatus = (id: number, TrangThai: string) => prisma().tAI_KHOAN.update({ where: { MaTaiKhoan: id }, data: { TrangThai } });
const setRole = async (id: number, role: string) => prisma().tAI_KHOAN.update({ where: { MaTaiKhoan: id }, data: { MaVaiTro: await getRoleId(role as never) } });

const me = (token: string) => request(app).get('/api/profile/me').set('Authorization', `Bearer ${token}`);
const myBookings = (token: string) => request(app).get('/api/bookings').set('Authorization', `Bearer ${token}`); // customers only
const ownerHotels = (token: string) => request(app).get('/api/owner/hotels').set('Authorization', `Bearer ${token}`); // owners only
const adminAccounts = (token: string) => request(app).get('/api/admin/accounts').set('Authorization', `Bearer ${token}`); // admins only

afterAll(async () => {
  await Promise.all(ids.map((id) => deleteTestAccount(id)));
});

describe('a locked account loses API access at once, with the same still-valid access token', () => {
  it('401 while locked, the same token works again after an admin unlocks it', async () => {
    const user = await newAccount(ROLE_NAMES.CUSTOMER);
    expect((await me(user.token)).status).toBe(200);

    await setStatus(user.id, ACCOUNT_STATUS.LOCKED);
    const locked = await me(user.token);
    expect(locked.status).toBe(401);
    expect(locked.body.message).toBe('Tài khoản không khả dụng');
    expect((await myBookings(user.token)).status).toBe(401);

    await setStatus(user.id, ACCOUNT_STATUS.ACTIVE);
    expect((await me(user.token)).status).toBe(200);
  });

  it('locked owners and admins lose their endpoints too', async () => {
    const owner = await newAccount(ROLE_NAMES.PARTNER);
    const admin = await newAccount(ROLE_NAMES.ADMIN);
    expect((await ownerHotels(owner.token)).status).toBe(200);
    expect((await adminAccounts(admin.token)).status).toBe(200);

    await setStatus(owner.id, ACCOUNT_STATUS.LOCKED);
    await setStatus(admin.id, ACCOUNT_STATUS.LOCKED);
    expect((await ownerHotels(owner.token)).status).toBe(401);
    expect((await adminAccounts(admin.token)).status).toBe(401);
  });

  it('a token whose account no longer exists is rejected', async () => {
    const ghost = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
    const token = signAccessToken({ sub: String(ghost.account.MaTaiKhoan), role: ROLE_NAMES.CUSTOMER });
    await deleteTestAccount(ghost.account.MaTaiKhoan);
    expect((await me(token)).status).toBe(401);
  });

  it('a malformed or missing token is still a plain 401', async () => {
    expect((await me('not-a-jwt')).status).toBe(401);
    expect((await request(app).get('/api/profile/me')).status).toBe(401);
  });
});

describe('the role comes from the database, not from the token', () => {
  it('customer promoted to owner: the old customer token now reaches owner endpoints and loses customer ones', async () => {
    const user = await newAccount(ROLE_NAMES.CUSTOMER);
    expect((await myBookings(user.token)).status).toBe(200);
    expect((await ownerHotels(user.token)).status).toBe(403);

    await setRole(user.id, ROLE_NAMES.PARTNER);

    expect((await ownerHotels(user.token)).status).toBe(200);
    expect((await myBookings(user.token)).status).toBe(403);
  });

  it('admin demoted to customer: the old admin token loses every admin endpoint immediately', async () => {
    const admin = await newAccount(ROLE_NAMES.ADMIN);
    expect((await adminAccounts(admin.token)).status).toBe(200);

    await setRole(admin.id, ROLE_NAMES.CUSTOMER);

    expect((await adminAccounts(admin.token)).status).toBe(403);
    expect((await myBookings(admin.token)).status).toBe(200);
  });

  it('a customer cannot use a token that CLAIMS the admin role: the database role decides', async () => {
    const customer = await newAccount(ROLE_NAMES.CUSTOMER);
    const forged = signAccessToken({ sub: String(customer.id), role: ROLE_NAMES.ADMIN });
    expect((await adminAccounts(forged)).status).toBe(403);
  });

  it('the permission matrix after a change: owner, admin and customer each see exactly their own endpoints', async () => {
    const customer = await newAccount(ROLE_NAMES.CUSTOMER);
    const owner = await newAccount(ROLE_NAMES.PARTNER);
    const admin = await newAccount(ROLE_NAMES.ADMIN);
    const matrix = async (token: string) => [(await myBookings(token)).status, (await ownerHotels(token)).status, (await adminAccounts(token)).status];

    expect(await matrix(customer.token)).toEqual([200, 403, 403]);
    expect(await matrix(owner.token)).toEqual([403, 200, 403]);
    expect(await matrix(admin.token)).toEqual([403, 403, 200]);

    await setRole(owner.id, ROLE_NAMES.ADMIN);
    await setRole(admin.id, ROLE_NAMES.CUSTOMER);
    expect(await matrix(owner.token)).toEqual([403, 403, 200]);
    expect(await matrix(admin.token)).toEqual([200, 403, 403]);
  });
});

describe('a password reset never unlocks an account', () => {
  const noMail = () => {
    const sent: unknown[] = [];
    const email: EmailService = { sendPasswordResetEmail: async (m) => { sent.push(m); } };
    return { sent, service: new AuthService(undefined, undefined, email) };
  };

  it('a reset token issued before the lock is refused afterwards: the account stays locked, the password unchanged', async () => {
    const user = await newAccount(ROLE_NAMES.CUSTOMER);
    const before = await prisma().tAI_KHOAN.findUniqueOrThrow({ where: { MaTaiKhoan: user.id } });
    const token = signPasswordResetToken(user.id, before.MatKhau);
    await setStatus(user.id, ACCOUNT_STATUS.LOCKED);

    const res = await request(app).post('/api/auth/reset-password').send({ token, MatKhauMoi: 'BrandNewPassw0rd!' });

    expect(res.status).toBe(400);
    const after = await prisma().tAI_KHOAN.findUniqueOrThrow({ where: { MaTaiKhoan: user.id } });
    expect(after.TrangThai).toBe(ACCOUNT_STATUS.LOCKED);
    expect(after.MatKhau).toBe(before.MatKhau);
    expect((await me(user.token)).status).toBe(401);
    const loginAttempt = await request(app).post('/api/auth/login').send({ identifier: user.account.Email, MatKhau: 'BrandNewPassw0rd!' });
    expect(loginAttempt.status).not.toBe(200);
  });

  it('forgot-password sends nothing for a locked account, but still for an active one', async () => {
    const locked = await newAccount(ROLE_NAMES.CUSTOMER);
    const active = await newAccount(ROLE_NAMES.CUSTOMER);
    await setStatus(locked.id, ACCOUNT_STATUS.LOCKED);
    const { sent, service } = noMail();

    await service.forgotPassword({ Email: locked.account.Email });
    expect(sent).toHaveLength(0);
    await service.forgotPassword({ Email: active.account.Email });
    expect(sent).toHaveLength(1);
  });

  it('a normal reset on an active account still works and leaves it active', async () => {
    const user = await newAccount(ROLE_NAMES.CUSTOMER);
    const row = await prisma().tAI_KHOAN.findUniqueOrThrow({ where: { MaTaiKhoan: user.id } });
    const token = signPasswordResetToken(user.id, row.MatKhau);

    const res = await request(app).post('/api/auth/reset-password').send({ token, MatKhauMoi: 'BrandNewPassw0rd!' });

    expect(res.status).toBe(200);
    expect((await prisma().tAI_KHOAN.findUniqueOrThrow({ where: { MaTaiKhoan: user.id } })).TrangThai).toBe(ACCOUNT_STATUS.ACTIVE);
  });
});

