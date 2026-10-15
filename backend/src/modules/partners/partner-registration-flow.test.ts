import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { createTestAccount, deleteTestAccount } from '../../test/factories';
import { ROLE_NAMES } from '../../common/constants/roles';
import { ACCOUNT_STATUS, PARTNER_APPLICATION_STATUS } from '../../common/constants/account-status';
import { getPrismaClient } from '../../config/prisma';

/**
 * End-to-end partner registration flow over HTTP: register -> apply -> (pending limits) -> approve / reject
 * -> re-apply, plus the guards around it. Complements partners.test.ts (which covers each endpoint alone).
 */

const created: number[] = [];
afterAll(async () => {
  await Promise.all(created.map((id) => deleteTestAccount(id)));
});

let seq = 0;
const application = () => ({
  SoCCCD: '079099001234',
  SoGiayPhepKinhDoanh: `GP-${Date.now()}-${++seq}`,
  MaSoThue: `MST-${Date.now()}-${seq}`,
  TepGiayTo: 'https://example.com/documents/license.pdf',
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const login = async (identifier: string, password: string) => {
  const res = await request(app).post('/api/auth/login').send({ identifier, MatKhau: password });
  return res;
};

const customer = async () => {
  const { account, plainPassword } = await createTestAccount();
  created.push(account.MaTaiKhoan);
  const res = await login(account.Email, plainPassword);
  return { account, plainPassword, token: res.body.data.accessToken as string };
};

const admin = async () => {
  const { account, plainPassword } = await createTestAccount({ role: ROLE_NAMES.ADMIN });
  created.push(account.MaTaiKhoan);
  const res = await login(account.Email, plainPassword);
  return { account, token: res.body.data.accessToken as string };
};

const apply = (token: string, body: object = application()) =>
  request(app).post('/api/partners/apply').set(auth(token)).send(body);

const me = async (token: string) => (await request(app).get('/api/profile/me').set(auth(token))).body.data;

/** The customer-only features an account in review (or a partner) must not reach. */
const customerOnlyCalls = (token: string) => [
  request(app).get('/api/bookings').set(auth(token)),
  request(app).get('/api/support').set(auth(token)),
  request(app).post('/api/support').set(auth(token)).send({ TieuDe: 'x', NoiDung: 'y' }),
  request(app).post('/api/hotels/1/bookings').set(auth(token)).send({}),
  request(app).post('/api/bookings/1/review').set(auth(token)).send({}),
  request(app).post('/api/bookings/1/payments/simulate').set(auth(token)),
  request(app).post('/api/bookings/1/cancel').set(auth(token)).send({}),
];

describe('registration', () => {
  it('a new account is a plain customer with no partner flags', async () => {
    const suffix = `${Date.now()}${++seq}`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        TenDangNhap: `reg_${suffix}`,
        Email: `reg_${suffix}@example.com`,
        MatKhau: 'Password123',
        HoTen: 'Người Đăng Ký',
        SoDienThoai: '0901234567',
      });
    expect(res.status).toBe(201);
    created.push(res.body.data.account.MaTaiKhoan);
    expect(res.body.data.account.DangChoDuyetDoiTac).toBe(false);
    expect(res.body.data.account.HoSoDoiTacBiTuChoi).toBe(false);
    expect((await request(app).get('/api/partners/me').set(auth(res.body.data.accessToken))).body.data).toBeNull();
  });
});

describe('apply — validation and authorization', () => {
  it('401 without a token', async () => {
    expect((await request(app).post('/api/partners/apply').send(application())).status).toBe(401);
  });

  it.each([
    ['SoCCCD', ''],
    ['SoGiayPhepKinhDoanh', ''],
    ['MaSoThue', ''],
    ['TepGiayTo', ''],
  ])('400 when %s is invalid', async (field, value) => {
    const { token } = await customer();
    const res = await apply(token, { ...application(), [field]: value });
    expect(res.status).toBe(400);
  });

  it('400 when the body is empty, and nothing is created', async () => {
    const { account, token } = await customer();
    expect((await apply(token, {})).status).toBe(400);
    expect(await getPrismaClient().hO_SO_DOI_TAC.count({ where: { MaTaiKhoan: account.MaTaiKhoan } })).toBe(0);
  });

  it.each([ROLE_NAMES.PARTNER, ROLE_NAMES.ADMIN])('403 when the caller is already %s', async (role) => {
    const { account, plainPassword } = await createTestAccount({ role });
    created.push(account.MaTaiKhoan);
    const token = (await login(account.Email, plainPassword)).body.data.accessToken as string;
    expect((await apply(token)).status).toBe(403);
  });

  it('a locked account cannot sign in to apply', async () => {
    const { account, plainPassword } = await createTestAccount({ status: ACCOUNT_STATUS.LOCKED });
    created.push(account.MaTaiKhoan);
    expect((await login(account.Email, plainPassword)).status).toBe(403);
  });
});

describe('while the application is pending', () => {
  it('flags the account, blocks every customer-only feature, keeps browsing and the application page open', async () => {
    const { token, account, plainPassword } = await customer();
    expect((await apply(token)).status).toBe(201);

    const profile = await me(token);
    expect(profile.DangChoDuyetDoiTac).toBe(true);
    expect(profile.HoSoDoiTacBiTuChoi).toBe(false);
    expect(profile.MaVaiTro).toBeDefined();

    const reLogin = await login(account.Email, plainPassword);
    expect(reLogin.body.data.account.DangChoDuyetDoiTac).toBe(true);

    for (const call of customerOnlyCalls(token)) {
      expect((await call).status).toBe(403);
    }

    // Still allowed: browsing, own application, own profile.
    const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
    expect((await request(app).get(`/api/hotels?checkIn=${day(30)}&checkOut=${day(31)}&guests=1`)).status).toBe(200);
    const mine = await request(app).get('/api/partners/me').set(auth(token));
    expect(mine.status).toBe(200);
    expect(mine.body.data.TrangThaiDuyet).toBe(PARTNER_APPLICATION_STATUS.PENDING);
    expect((await request(app).patch('/api/profile/me').set(auth(token)).send({ HoTen: 'Tên Mới' })).status).toBe(200);
  });

  it('a second application is a 409, not a 403, and only one row exists', async () => {
    const { token, account } = await customer();
    await apply(token);
    const again = await apply(token);
    expect(again.status).toBe(409);
    expect(await getPrismaClient().hO_SO_DOI_TAC.count({ where: { MaTaiKhoan: account.MaTaiKhoan } })).toBe(1);
  });

  it('is scoped per account: another customer is not affected', async () => {
    const a = await customer();
    const b = await customer();
    await apply(a.token);
    expect((await me(b.token)).DangChoDuyetDoiTac).toBe(false);
    expect((await request(app).get('/api/partners/me').set(auth(b.token))).body.data).toBeNull();
    expect((await request(app).get('/api/support').set(auth(b.token))).status).toBe(200);
  });
});

describe('admin decision', () => {
  it('a customer cannot approve or reject (403) and the application stays pending', async () => {
    const applicant = await customer();
    const other = await customer();
    const submitted = await apply(applicant.token);
    const id = submitted.body.data.MaHoSoDoiTac as number;

    expect((await request(app).post(`/api/admin/partner-applications/${id}/approve`).set(auth(other.token))).status).toBe(403);
    expect((await request(app).post(`/api/admin/partner-applications/${id}/reject`).set(auth(other.token)).send({ LyDoTuChoi: 'x' })).status).toBe(403);
    expect((await me(applicant.token)).DangChoDuyetDoiTac).toBe(true);
  });

  it('approval: becomes partner, flags cleared, owner area open, customer features closed, cannot apply again', async () => {
    const applicant = await customer();
    const adm = await admin();
    const id = (await apply(applicant.token)).body.data.MaHoSoDoiTac as number;

    const approved = await request(app).post(`/api/admin/partner-applications/${id}/approve`).set(auth(adm.token));
    expect(approved.status).toBe(200);

    // The role is read from the DB on each request, so the old token already acts as a partner.
    const profile = await me(applicant.token);
    expect(profile.DangChoDuyetDoiTac).toBe(false);
    expect(profile.HoSoDoiTacBiTuChoi).toBe(false);

    const partnerRole = await getPrismaClient().vAI_TRO.findUnique({ where: { TenVaiTro: ROLE_NAMES.PARTNER } });
    expect(profile.MaVaiTro).toBe(partnerRole?.MaVaiTro);

    expect((await request(app).get('/api/owner/hotels').set(auth(applicant.token))).status).toBe(200);
    for (const call of customerOnlyCalls(applicant.token)) {
      expect((await call).status).toBe(403);
    }
    expect((await apply(applicant.token)).status).toBe(403);
  });

  it('rejection: still a customer, reason visible, flag set, customer features open again', async () => {
    const applicant = await customer();
    const adm = await admin();
    const id = (await apply(applicant.token)).body.data.MaHoSoDoiTac as number;
    expect((await request(app).get('/api/support').set(auth(applicant.token))).status).toBe(403);

    const rejected = await request(app)
      .post(`/api/admin/partner-applications/${id}/reject`)
      .set(auth(adm.token))
      .send({ LyDoTuChoi: 'Giấy tờ không rõ' });
    expect(rejected.status).toBe(200);

    const profile = await me(applicant.token);
    expect(profile.DangChoDuyetDoiTac).toBe(false);
    expect(profile.HoSoDoiTacBiTuChoi).toBe(true);

    const mine = await request(app).get('/api/partners/me').set(auth(applicant.token));
    expect(mine.body.data.TrangThaiDuyet).toBe(PARTNER_APPLICATION_STATUS.REJECTED);
    expect(mine.body.data.LyDoTuChoi).toBe('Giấy tờ không rõ');

    expect((await request(app).get('/api/support').set(auth(applicant.token))).status).toBe(200);
    expect((await request(app).get('/api/bookings').set(auth(applicant.token))).status).toBe(200);
    expect((await request(app).get('/api/owner/hotels').set(auth(applicant.token))).status).toBe(403);
  });

  it('re-apply after a rejection: new pending row, history kept, flags flip, then it can be approved', async () => {
    const applicant = await customer();
    const adm = await admin();
    const first = (await apply(applicant.token)).body.data.MaHoSoDoiTac as number;
    await request(app).post(`/api/admin/partner-applications/${first}/reject`).set(auth(adm.token)).send({ LyDoTuChoi: 'Thiếu thông tin' });

    const second = await apply(applicant.token);
    expect(second.status).toBe(201);
    expect(second.body.data.MaHoSoDoiTac).not.toBe(first);

    const profile = await me(applicant.token);
    expect(profile.HoSoDoiTacBiTuChoi).toBe(false);
    expect(profile.DangChoDuyetDoiTac).toBe(true);
    expect((await request(app).get('/api/support').set(auth(applicant.token))).status).toBe(403);

    const rows = await getPrismaClient().hO_SO_DOI_TAC.findMany({
      where: { MaTaiKhoan: applicant.account.MaTaiKhoan },
      orderBy: { NgayNop: 'asc' },
    });
    expect(rows.map((r) => r.TrangThaiDuyet)).toEqual([PARTNER_APPLICATION_STATUS.REJECTED, PARTNER_APPLICATION_STATUS.PENDING]);

    const approved = await request(app).post(`/api/admin/partner-applications/${second.body.data.MaHoSoDoiTac}/approve`).set(auth(adm.token));
    expect(approved.status).toBe(200);
    expect((await request(app).get('/api/owner/hotels').set(auth(applicant.token))).status).toBe(200);
  });

  it('a rejected application cannot be approved afterwards (409) and the role does not change', async () => {
    const applicant = await customer();
    const adm = await admin();
    const id = (await apply(applicant.token)).body.data.MaHoSoDoiTac as number;
    await request(app).post(`/api/admin/partner-applications/${id}/reject`).set(auth(adm.token)).send({ LyDoTuChoi: 'Không đạt' });

    expect((await request(app).post(`/api/admin/partner-applications/${id}/approve`).set(auth(adm.token))).status).toBe(409);
    expect((await request(app).get('/api/owner/hotels').set(auth(applicant.token))).status).toBe(403);
  });

  it('concurrent approve + reject: exactly one decision wins and the role matches it', async () => {
    const applicant = await customer();
    const adm = await admin();
    const id = (await apply(applicant.token)).body.data.MaHoSoDoiTac as number;

    const [approve, reject] = await Promise.all([
      request(app).post(`/api/admin/partner-applications/${id}/approve`).set(auth(adm.token)),
      request(app).post(`/api/admin/partner-applications/${id}/reject`).set(auth(adm.token)).send({ LyDoTuChoi: 'Đồng thời' }),
    ]);
    const statuses = [approve.status, reject.status].sort();
    expect(statuses[0]).toBe(200);
    expect(statuses[1]).toBe(409);

    const row = await getPrismaClient().hO_SO_DOI_TAC.findUnique({ where: { MaHoSoDoiTac: id } });
    const ownerStatus = (await request(app).get('/api/owner/hotels').set(auth(applicant.token))).status;
    if (row?.TrangThaiDuyet === PARTNER_APPLICATION_STATUS.APPROVED) expect(ownerStatus).toBe(200);
    else expect(ownerStatus).toBe(403);
  });

  it('flags are false for a partner/admin even if an old rejected application exists', async () => {
    const { account, plainPassword } = await createTestAccount({ role: ROLE_NAMES.PARTNER });
    created.push(account.MaTaiKhoan);
    await getPrismaClient().hO_SO_DOI_TAC.create({
      data: {
        ...application(),
        TrangThaiDuyet: PARTNER_APPLICATION_STATUS.REJECTED,
        LyDoTuChoi: 'cũ',
        NgayNop: new Date(Date.now() - 60_000),
        TAI_KHOAN_HO_SO_DOI_TAC_MaTaiKhoanToTAI_KHOAN: { connect: { MaTaiKhoan: account.MaTaiKhoan } },
      },
    });
    const res = await login(account.Email, plainPassword);
    expect(res.body.data.account.HoSoDoiTacBiTuChoi).toBe(false);
    expect(res.body.data.account.DangChoDuyetDoiTac).toBe(false);
  });
});
