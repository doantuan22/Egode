import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { createTestAccount, deleteTestAccount } from '../../test/factories';
import { ROLE_NAMES } from '../../common/constants/roles';
import { getPrismaClient } from '../../config/prisma';
import { PARTNER_APPLICATION_STATUS } from '../../common/constants/account-status';
import { PartnersService } from './partners.service';
import type { PartnersRepository } from './partners.repository';

const createdAccountIds: number[] = [];
afterAll(async () => {
  await Promise.all(createdAccountIds.map((id) => deleteTestAccount(id)));
});

const loginAndGetToken = async (email: string, password: string) => {
  const res = await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password });
  return res.body.data.accessToken as string;
};

const makeAdminToken = async () => {
  const { account, plainPassword } = await createTestAccount({ role: ROLE_NAMES.ADMIN });
  createdAccountIds.push(account.MaTaiKhoan);
  return { account, token: await loginAndGetToken(account.Email, plainPassword) };
};

const validApplication = () => ({
  SoCCCD: '079099001234',
  SoGiayPhepKinhDoanh: `GP-${Date.now()}`,
  MaSoThue: `MST-${Date.now()}`,
  TepGiayTo: 'https://example.com/documents/business-license.pdf',
});

describe('POST /api/partners/apply', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/api/partners/apply').send(validApplication());
    expect(res.status).toBe(401);
  });

  it('lets an authenticated customer submit a partner application', async () => {
    const { account, plainPassword } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);
    const token = await loginAndGetToken(account.Email, plainPassword);

    const res = await request(app)
      .post('/api/partners/apply')
      .set('Authorization', `Bearer ${token}`)
      .send(validApplication());

    expect(res.status).toBe(201);
    expect(res.body.data.TrangThaiDuyet).toBe('Chờ duyệt');
    expect(res.body.data.MaTaiKhoan).toBe(account.MaTaiKhoan);
  });

  it('rejects a second application while one is still pending', async () => {
    const { account, plainPassword } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);
    const token = await loginAndGetToken(account.Email, plainPassword);

    await request(app).post('/api/partners/apply').set('Authorization', `Bearer ${token}`).send(validApplication());
    const second = await request(app)
      .post('/api/partners/apply')
      .set('Authorization', `Bearer ${token}`)
      .send(validApplication());

    expect(second.status).toBe(409);
  });
});

describe('GET /api/partners/me', () => {
  it("returns the caller's latest application status", async () => {
    const { account, plainPassword } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);
    const token = await loginAndGetToken(account.Email, plainPassword);

    await request(app).post('/api/partners/apply').set('Authorization', `Bearer ${token}`).send(validApplication());
    const res = await request(app).get('/api/partners/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.TrangThaiDuyet).toBe('Chờ duyệt');
  });

  it('returns null when no application has been submitted yet', async () => {
    const { account, plainPassword } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);
    const token = await loginAndGetToken(account.Email, plainPassword);

    const res = await request(app).get('/api/partners/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });
});

describe('admin partner application workflow (UC32)', () => {
  it('does not leave approval data changed when the role update fails inside the transaction', async () => {
    const now = new Date('2026-01-01T10:00:00.000Z');
    const state = {
      application: {
        MaHoSoDoiTac: 9001,
        MaTaiKhoan: 9002,
        TrangThaiDuyet: PARTNER_APPLICATION_STATUS.PENDING,
        NgayNop: new Date('2026-01-01T09:00:00.000Z'),
      },
      roleId: 1,
    };
    const repository = {
      runInTransaction: async (callback: (tx: unknown) => Promise<unknown>) => {
        const snapshot = { status: state.application.TrangThaiDuyet, roleId: state.roleId };
        const tx = {
          hO_SO_DOI_TAC: {
            findUnique: async () => state.application,
            updateMany: async ({ data }: { data: { TrangThaiDuyet: string } }) => {
              state.application.TrangThaiDuyet = data.TrangThaiDuyet;
              return { count: 1 };
            },
          },
          vAI_TRO: { findUnique: async () => ({ MaVaiTro: 2 }) },
          tAI_KHOAN: { update: async () => { throw new Error('simulated role update failure'); } },
        };
        try { return await callback(tx); } catch (error) {
          state.application.TrangThaiDuyet = snapshot.status;
          state.roleId = snapshot.roleId;
          throw error;
        }
      },
      findPendingById: async (tx: { hO_SO_DOI_TAC: { findUnique: () => Promise<unknown> } }) => tx.hO_SO_DOI_TAC.findUnique(),
      updatePendingStatus: async (tx: { hO_SO_DOI_TAC: { updateMany: (args: unknown) => Promise<unknown> } }, id: number, adminId: number, status: string, reason: string | null, time: Date) => tx.hO_SO_DOI_TAC.updateMany({ data: { TrangThaiDuyet: status, MaTaiKhoanDuyet: adminId, NgayDuyet: time, LyDoTuChoi: reason } }),
      updateAccountRole: async () => { throw new Error('simulated role update failure'); },
    } as unknown as PartnersRepository;

    const service = new PartnersService(repository);
    await expect(service.approve(state.application.MaHoSoDoiTac, 9003)).rejects.toThrow('simulated role update failure');
    expect(state.application.TrangThaiDuyet).toBe(PARTNER_APPLICATION_STATUS.PENDING);
    expect(state.roleId).toBe(1);
    void now;
  });

  it('does not allow a customer to call admin list/detail/moderation APIs', async () => {
    const { account, plainPassword } = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
    createdAccountIds.push(account.MaTaiKhoan);
    const token = await loginAndGetToken(account.Email, plainPassword);

    expect((await request(app).get('/api/admin/partner-applications').set('Authorization', `Bearer ${token}`)).status).toBe(403);
    expect((await request(app).get('/api/admin/partner-applications/1').set('Authorization', `Bearer ${token}`)).status).toBe(403);
    expect((await request(app).post('/api/admin/partner-applications/1/approve').set('Authorization', `Bearer ${token}`)).status).toBe(403);
  });

  it('lists, details, approves, records the token admin, and changes only the role', async () => {
    const applicant = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
    createdAccountIds.push(applicant.account.MaTaiKhoan);
    const { account: admin, token: adminToken } = await makeAdminToken();
    const customerToken = await loginAndGetToken(applicant.account.Email, applicant.plainPassword);
    const submitted = await request(app).post('/api/partners/apply').set('Authorization', `Bearer ${customerToken}`).send(validApplication());
    const applicationId = submitted.body.data.MaHoSoDoiTac as number;

    const list = await request(app).get('/api/admin/partner-applications?trangThaiDuyet=Chờ%20duyệt').set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.some((item: { MaHoSoDoiTac: number }) => item.MaHoSoDoiTac === applicationId)).toBe(true);

    const detail = await request(app).get(`/api/admin/partner-applications/${applicationId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.MaTaiKhoan).toBe(applicant.account.MaTaiKhoan);

    const approved = await request(app)
      .post(`/api/admin/partner-applications/${applicationId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ MaTaiKhoanDuyet: applicant.account.MaTaiKhoan, TrangThaiDuyet: PARTNER_APPLICATION_STATUS.REJECTED });
    expect(approved.status).toBe(200);
    expect(approved.body.data.TrangThaiDuyet).toBe(PARTNER_APPLICATION_STATUS.APPROVED);
    expect(approved.body.data.MaTaiKhoanDuyet).toBe(admin.MaTaiKhoan);
    expect(new Date(approved.body.data.NgayDuyet).getTime()).toBeGreaterThanOrEqual(new Date(approved.body.data.NgayNop).getTime());

    const prisma = getPrismaClient();
    const partnerRole = await prisma.vAI_TRO.findUnique({ where: { TenVaiTro: ROLE_NAMES.PARTNER } });
    const updatedAccount = await prisma.tAI_KHOAN.findUnique({ where: { MaTaiKhoan: applicant.account.MaTaiKhoan } });
    expect(updatedAccount?.MaVaiTro).toBe(partnerRole?.MaVaiTro);
    expect(await prisma.kHACH_SAN.count({ where: { MaTaiKhoanSoHuu: applicant.account.MaTaiKhoan } })).toBe(0);

    const secondAttempt = await request(app).post(`/api/admin/partner-applications/${applicationId}/approve`).set('Authorization', `Bearer ${adminToken}`);
    expect(secondAttempt.status).toBe(409);
  });

  it('requires a rejection reason, keeps the customer role, and stores the admin from the token', async () => {
    const applicant = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
    createdAccountIds.push(applicant.account.MaTaiKhoan);
    const { account: admin, token: adminToken } = await makeAdminToken();
    const customerToken = await loginAndGetToken(applicant.account.Email, applicant.plainPassword);
    const submitted = await request(app).post('/api/partners/apply').set('Authorization', `Bearer ${customerToken}`).send(validApplication());
    const applicationId = submitted.body.data.MaHoSoDoiTac as number;

    expect((await request(app).post(`/api/admin/partner-applications/${applicationId}/reject`).set('Authorization', `Bearer ${adminToken}`).send({})).status).toBe(400);
    const rejected = await request(app).post(`/api/admin/partner-applications/${applicationId}/reject`).set('Authorization', `Bearer ${adminToken}`).send({ LyDoTuChoi: 'Hồ sơ chưa đủ giấy tờ' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.TrangThaiDuyet).toBe(PARTNER_APPLICATION_STATUS.REJECTED);
    expect(rejected.body.data.LyDoTuChoi).toBe('Hồ sơ chưa đủ giấy tờ');
    expect(rejected.body.data.MaTaiKhoanDuyet).toBe(admin.MaTaiKhoan);
    expect(new Date(rejected.body.data.NgayDuyet).getTime()).toBeGreaterThanOrEqual(new Date(rejected.body.data.NgayNop).getTime());

    const prisma = getPrismaClient();
    const customerRole = await prisma.vAI_TRO.findUnique({ where: { TenVaiTro: ROLE_NAMES.CUSTOMER } });
    const unchangedAccount = await prisma.tAI_KHOAN.findUnique({ where: { MaTaiKhoan: applicant.account.MaTaiKhoan } });
    expect(unchangedAccount?.MaVaiTro).toBe(customerRole?.MaVaiTro);
    expect((await request(app).post(`/api/admin/partner-applications/${applicationId}/reject`).set('Authorization', `Bearer ${adminToken}`).send({ LyDoTuChoi: 'Lần hai' })).status).toBe(409);
  });

  it('scopes customer status to the authenticated account', async () => {
    const first = await createTestAccount();
    const second = await createTestAccount();
    createdAccountIds.push(first.account.MaTaiKhoan, second.account.MaTaiKhoan);
    const firstToken = await loginAndGetToken(first.account.Email, first.plainPassword);
    const secondToken = await loginAndGetToken(second.account.Email, second.plainPassword);
    await request(app).post('/api/partners/apply').set('Authorization', `Bearer ${firstToken}`).send(validApplication());
    const secondView = await request(app).get('/api/partners/me').set('Authorization', `Bearer ${secondToken}`);
    expect(secondView.status).toBe(200);
    expect(secondView.body.data).toBeNull();
  });
});

describe('account with a pending partner application is limited like a partner', () => {
  it('flags the account on /profile/me and gets 403 on customer-only APIs, but may still read its application', async () => {
    const { account, plainPassword } = await createTestAccount();
    const login = await request(app).post('/api/auth/login').send({ identifier: account.Email, MatKhau: plainPassword });
    const token = login.body.data.accessToken as string;
    expect(login.body.data.account.DangChoDuyetDoiTac).toBe(false);

    const apply = await request(app)
      .post('/api/partners/apply')
      .set('Authorization', `Bearer ${token}`)
      .send({ SoCCCD: '012345678901', SoGiayPhepKinhDoanh: 'GPKD-123456', MaSoThue: '0123456789', TepGiayTo: 'https://example.com/doc.pdf' });
    expect(apply.status).toBe(201);

    const me = await request(app).get('/api/profile/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.data.DangChoDuyetDoiTac).toBe(true);

    for (const path of ['/api/bookings', '/api/support']) {
      const res = await request(app).get(path).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    }
    const mine = await request(app).get('/api/partners/me').set('Authorization', `Bearer ${token}`);
    expect(mine.status).toBe(200);

    await deleteTestAccount(account.MaTaiKhoan);
  });
});

describe('rejected application flag', () => {
  it('sets HoSoDoiTacBiTuChoi on /profile/me after a rejection and clears it once a new application is pending', async () => {
    const { account, plainPassword } = await createTestAccount();
    const prisma = getPrismaClient();
    await prisma.hO_SO_DOI_TAC.create({
      data: {
        SoCCCD: '012345678901', SoGiayPhepKinhDoanh: 'GPKD-1', MaSoThue: '0123456789', TepGiayTo: 'https://example.com/a.pdf',
        TrangThaiDuyet: PARTNER_APPLICATION_STATUS.REJECTED, LyDoTuChoi: 'Thiếu giấy tờ', NgayNop: new Date(Date.now() - 60_000),
        TAI_KHOAN_HO_SO_DOI_TAC_MaTaiKhoanToTAI_KHOAN: { connect: { MaTaiKhoan: account.MaTaiKhoan } },
      },
    });
    const login = await request(app).post('/api/auth/login').send({ identifier: account.Email, MatKhau: plainPassword });
    expect(login.body.data.account.HoSoDoiTacBiTuChoi).toBe(true);
    expect(login.body.data.account.DangChoDuyetDoiTac).toBe(false);
    const token = login.body.data.accessToken as string;

    const again = await request(app)
      .post('/api/partners/apply')
      .set('Authorization', `Bearer ${token}`)
      .send({ SoCCCD: '012345678901', SoGiayPhepKinhDoanh: 'GPKD-123456', MaSoThue: '0123456789', TepGiayTo: 'https://example.com/doc.pdf' });
    expect(again.status).toBe(201);
    const me = await request(app).get('/api/profile/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.data.HoSoDoiTacBiTuChoi).toBe(false);
    expect(me.body.data.DangChoDuyetDoiTac).toBe(true);

    await deleteTestAccount(account.MaTaiKhoan);
  });
});

describe('re-apply flag constraints', () => {
  const baseApp = {
    SoCCCD: '012345678901', SoGiayPhepKinhDoanh: 'GPKD-1', MaSoThue: '0123456789', TepGiayTo: 'https://example.com/a.pdf',
    TrangThaiDuyet: PARTNER_APPLICATION_STATUS.REJECTED, LyDoTuChoi: 'x', NgayNop: new Date(Date.now() - 60_000),
  };
  it('is false for a customer who never applied', async () => {
    const { account, plainPassword } = await createTestAccount();
    const login = await request(app).post('/api/auth/login').send({ identifier: account.Email, MatKhau: plainPassword });
    expect(login.body.data.account.HoSoDoiTacBiTuChoi).toBe(false);
    await deleteTestAccount(account.MaTaiKhoan);
  });
  it('is false when the account has a rejected application but is no longer a customer', async () => {
    const { account, plainPassword } = await createTestAccount({ role: ROLE_NAMES.PARTNER });
    await getPrismaClient().hO_SO_DOI_TAC.create({
      data: { ...baseApp, TAI_KHOAN_HO_SO_DOI_TAC_MaTaiKhoanToTAI_KHOAN: { connect: { MaTaiKhoan: account.MaTaiKhoan } } },
    });
    const login = await request(app).post('/api/auth/login').send({ identifier: account.Email, MatKhau: plainPassword });
    expect(login.body.data.account.HoSoDoiTacBiTuChoi).toBe(false);
    await deleteTestAccount(account.MaTaiKhoan);
  });
});
