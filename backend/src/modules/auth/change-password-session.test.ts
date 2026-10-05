import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { createTestAccount, deleteTestAccount } from '../../test/factories';
import { getPrismaClient } from '../../config/prisma';
import { env } from '../../config/env';
import { ROLE_NAMES } from '../../common/constants/roles';
import { ACCOUNT_STATUS } from '../../common/constants/account-status';

/**
 * Bug #12 — change-password is a PROTECTED endpoint. When the 15-minute access token has expired but the session is
 * still alive (refresh cookie), the client must be able to refresh and retry; these tests walk that exact sequence
 * against the real API, and pin the field-level errors the form maps onto its inputs.
 */
const ids: number[] = [];
const NEW_PASSWORD = 'Brand-New-Passw0rd!';

afterAll(async () => {
  await Promise.all(ids.map((id) => deleteTestAccount(id)));
});

const signedIn = async () => {
  const created = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  ids.push(created.account.MaTaiKhoan);
  const agent = request.agent(app); // keeps the refresh cookie like a browser does
  const login = await agent.post('/api/auth/login').send({ identifier: created.account.Email, MatKhau: created.plainPassword });
  return { ...created, id: created.account.MaTaiKhoan, agent, accessToken: login.body.data.accessToken as string };
};

const expiredAccessToken = (id: number) =>
  jwt.sign({ sub: String(id), role: ROLE_NAMES.CUSTOMER, typ: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: -60,
    algorithm: 'HS256',
    issuer: 'hotel-booking-api',
    audience: 'hotel-booking-web',
  });

describe('POST /api/auth/change-password with an expired access token', () => {
  it('401 first; the refresh cookie gives a new access token; the retry changes the password; only the new password logs in', async () => {
    const user = await signedIn();
    const body = { MatKhauCu: user.plainPassword, MatKhauMoi: NEW_PASSWORD };

    const stale = await user.agent.post('/api/auth/change-password').set('Authorization', `Bearer ${expiredAccessToken(user.id)}`).send(body);
    expect(stale.status).toBe(401);
    expect(stale.body.code).toBe('UNAUTHORIZED');

    const refreshed = await user.agent.post('/api/auth/refresh');
    expect(refreshed.status).toBe(200);
    const fresh = refreshed.body.data.accessToken as string;

    const changed = await user.agent.post('/api/auth/change-password').set('Authorization', `Bearer ${fresh}`).send(body);
    expect(changed.status).toBe(200);
    expect(changed.body.data.accessToken).toEqual(expect.any(String)); // this device keeps its session

    expect((await request(app).post('/api/auth/login').send({ identifier: user.account.Email, MatKhau: user.plainPassword })).status).toBe(401);
    const relogin = await request(app).post('/api/auth/login').send({ identifier: user.account.Email, MatKhau: NEW_PASSWORD });
    expect(relogin.status).toBe(200);
  });

  it('the access token returned by the change works at once, and the OLD refresh cookie of another device does not', async () => {
    const user = await signedIn();
    const otherDevice = request.agent(app);
    await otherDevice.post('/api/auth/login').send({ identifier: user.account.Email, MatKhau: user.plainPassword });

    const changed = await user.agent.post('/api/auth/change-password').set('Authorization', `Bearer ${user.accessToken}`).send({ MatKhauCu: user.plainPassword, MatKhauMoi: NEW_PASSWORD });
    expect(changed.status).toBe(200);

    expect((await request(app).get('/api/profile/me').set('Authorization', `Bearer ${changed.body.data.accessToken}`)).status).toBe(200);
    expect((await user.agent.post('/api/auth/refresh')).status).toBe(200); // this device: the cookie was replaced
    expect((await otherDevice.post('/api/auth/refresh')).status).toBe(401); // other devices must sign in again
  });
});

describe('change-password errors follow the contract and name the field', () => {
  it('wrong current password: 400, details on MatKhauCu, password unchanged', async () => {
    const user = await signedIn();
    const res = await user.agent.post('/api/auth/change-password').set('Authorization', `Bearer ${user.accessToken}`).send({ MatKhauCu: 'Not-My-Password1', MatKhauMoi: NEW_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 'BAD_REQUEST', message: 'Mật khẩu hiện tại không đúng', details: [{ field: 'MatKhauCu' }] });
    expect((await request(app).post('/api/auth/login').send({ identifier: user.account.Email, MatKhau: user.plainPassword })).status).toBe(200);
  });

  it('new password equal to the current one: 400, details on MatKhauMoi', async () => {
    const user = await signedIn();
    const res = await user.agent.post('/api/auth/change-password').set('Authorization', `Bearer ${user.accessToken}`).send({ MatKhauCu: user.plainPassword, MatKhauMoi: user.plainPassword });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([expect.objectContaining({ field: 'MatKhauMoi' })]);
  });

  it('a new password shorter than the policy (8): VALIDATION_ERROR on MatKhauMoi', async () => {
    const user = await signedIn();
    const res = await user.agent.post('/api/auth/change-password').set('Authorization', `Bearer ${user.accessToken}`).send({ MatKhauCu: user.plainPassword, MatKhauMoi: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details.map((d: { field: string }) => d.field)).toContain('MatKhauMoi');
  });
});

describe('a locked account', () => {
  it('cannot change the password: its still-valid access token is refused, nothing changes, and it cannot refresh', async () => {
    const user = await signedIn();
    const before = await getPrismaClient().tAI_KHOAN.findUniqueOrThrow({ where: { MaTaiKhoan: user.id } });
    await getPrismaClient().tAI_KHOAN.update({ where: { MaTaiKhoan: user.id }, data: { TrangThai: ACCOUNT_STATUS.LOCKED } });

    const res = await user.agent.post('/api/auth/change-password').set('Authorization', `Bearer ${user.accessToken}`).send({ MatKhauCu: user.plainPassword, MatKhauMoi: NEW_PASSWORD });

    expect(res.status).toBe(401);
    const after = await getPrismaClient().tAI_KHOAN.findUniqueOrThrow({ where: { MaTaiKhoan: user.id } });
    expect(after.MatKhau).toBe(before.MatKhau);
    expect(after.TrangThai).toBe(ACCOUNT_STATUS.LOCKED);
    expect((await user.agent.post('/api/auth/refresh')).status).toBe(401);
  });
});
