import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { createTestAccount, deleteTestAccount, getRoleId } from '../../test/factories';
import { ROLE_NAMES } from '../../common/constants/roles';
import { ACCOUNT_STATUS } from '../../common/constants/account-status';
import { PARTNER_APPLICATION_STATUS } from '../../common/constants/account-status';
import { getPrismaClient } from '../../config/prisma';

const createdAccountIds: number[] = [];
afterAll(async () => {
  const prisma = getPrismaClient();
  await Promise.all(
    createdAccountIds.map((id) =>
      prisma.hO_SO_DOI_TAC.deleteMany({ where: { MaTaiKhoan: id } }).then(() => deleteTestAccount(id))
    )
  );
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

describe('RBAC on /api/admin/accounts', () => {
  it('rejects a customer token with 403', async () => {
    const { account, plainPassword } = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
    createdAccountIds.push(account.MaTaiKhoan);
    const token = await loginAndGetToken(account.Email, plainPassword);

    const res = await request(app).get('/api/admin/accounts').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('allows an admin token', async () => {
    const { token } = await makeAdminToken();
    const res = await request(app).get('/api/admin/accounts').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('rejects requests with no token at all', async () => {
    const res = await request(app).get('/api/admin/accounts');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/admin/accounts (UC28)', () => {
  it('allows an admin to create an account and never returns the password hash', async () => {
    const { token } = await makeAdminToken();
    const suffix = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const res = await request(app)
      .post('/api/admin/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        TenDangNhap: `created_admin_${suffix}`,
        Email: `created_admin_${suffix}@example.com`,
        MatKhau: 'Test@12345',
        HoTen: 'Created by admin',
        SoDienThoai: '0900000000',
        MaVaiTro: await getRoleId(ROLE_NAMES.CUSTOMER),
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ HoTen: 'Created by admin', Email: `created_admin_${suffix}@example.com` });
    expect(JSON.stringify(res.body.data)).not.toContain('MatKhau');
    createdAccountIds.push(res.body.data.MaTaiKhoan);
  });

  it('rejects a customer attempting to create an admin account', async () => {
    const { account, plainPassword } = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
    createdAccountIds.push(account.MaTaiKhoan);
    const token = await loginAndGetToken(account.Email, plainPassword);
    const res = await request(app).post('/api/admin/accounts').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/accounts (list/search)', () => {
  it('lists accounts with pagination metadata', async () => {
    const { token } = await makeAdminToken();
    const res = await request(app).get('/api/admin/accounts?page=1&limit=5').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 5 });
  });

  it('finds a specific account by search term', async () => {
    const { token } = await makeAdminToken();
    const { account } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);

    const res = await request(app)
      .get(`/api/admin/accounts?search=${account.TenDangNhap}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.some((a: { MaTaiKhoan: number }) => a.MaTaiKhoan === account.MaTaiKhoan)).toBe(
      true
    );
  });
});

describe('PATCH /api/admin/accounts/:id (update)', () => {
  it('updates an account', async () => {
    const { token } = await makeAdminToken();
    const { account } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);

    const res = await request(app)
      .patch(`/api/admin/accounts/${account.MaTaiKhoan}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ HoTen: 'Admin Edited Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.HoTen).toBe('Admin Edited Name');
  });
});

describe('POST /api/admin/accounts/:id/lock', () => {
  it('locks an account, and the locked account can no longer log in', async () => {
    const { token } = await makeAdminToken();
    const { account, plainPassword } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);

    const lockRes = await request(app)
      .post(`/api/admin/accounts/${account.MaTaiKhoan}/lock`)
      .set('Authorization', `Bearer ${token}`);
    expect(lockRes.status).toBe(200);
    expect(lockRes.body.data.TrangThai).toBe(ACCOUNT_STATUS.LOCKED);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: account.Email, MatKhau: plainPassword });
    expect(loginRes.status).toBe(403);
  });
});

describe('DELETE /api/admin/accounts/:id (safe delete)', () => {
  it('hard-deletes an account with no related history', async () => {
    const { token } = await makeAdminToken();
    const { account } = await createTestAccount();

    const res = await request(app)
      .delete(`/api/admin/accounts/${account.MaTaiKhoan}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.hardDeleted).toBe(true);

    const prisma = getPrismaClient();
    const row = await prisma.tAI_KHOAN.findUnique({ where: { MaTaiKhoan: account.MaTaiKhoan } });
    expect(row).toBeNull();
  });

  it('locks instead of hard-deleting an account that has related history (G0-10)', async () => {
    const { token } = await makeAdminToken();
    const { account } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);

    const prisma = getPrismaClient();
    await prisma.hO_SO_DOI_TAC.create({
      data: {
        SoCCCD: '000000000',
        SoGiayPhepKinhDoanh: 'GP-TEST',
        MaSoThue: 'MST-TEST',
        TepGiayTo: '/doc.pdf',
        TrangThaiDuyet: PARTNER_APPLICATION_STATUS.PENDING,
        NgayNop: new Date(),
        TAI_KHOAN_HO_SO_DOI_TAC_MaTaiKhoanToTAI_KHOAN: { connect: { MaTaiKhoan: account.MaTaiKhoan } },
      },
    });

    const res = await request(app)
      .delete(`/api/admin/accounts/${account.MaTaiKhoan}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.hardDeleted).toBe(false);

    const row = await prisma.tAI_KHOAN.findUnique({ where: { MaTaiKhoan: account.MaTaiKhoan } });
    expect(row?.TrangThai).toBe(ACCOUNT_STATUS.LOCKED);
  });
});

describe('Role lookups for admin account forms', () => {
  it('lists every role with its real id so the UI never hardcodes MaVaiTro', async () => {
    const { token } = await makeAdminToken();
    const res = await request(app).get('/api/admin/accounts/roles').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const names = res.body.data.map((r: { TenVaiTro: string }) => r.TenVaiTro);
    expect(names).toEqual(expect.arrayContaining([ROLE_NAMES.CUSTOMER, ROLE_NAMES.PARTNER, ROLE_NAMES.ADMIN]));
    const partner = res.body.data.find((r: { TenVaiTro: string }) => r.TenVaiTro === ROLE_NAMES.PARTNER);
    expect(partner.MaVaiTro).toBe(await getRoleId(ROLE_NAMES.PARTNER));
  });

  it('rejects the role lookup for a customer', async () => {
    const { account, plainPassword } = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
    createdAccountIds.push(account.MaTaiKhoan);
    const token = await loginAndGetToken(account.Email, plainPassword);
    const res = await request(app).get('/api/admin/accounts/roles').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns the role name with list and detail rows, never the password hash', async () => {
    const { token, account } = await makeAdminToken();
    const list = await request(app).get('/api/admin/accounts').query({ search: account.TenDangNhap }).set('Authorization', `Bearer ${token}`);
    expect(list.body.data[0].VAI_TRO.TenVaiTro).toBe(ROLE_NAMES.ADMIN);
    const detail = await request(app).get(`/api/admin/accounts/${account.MaTaiKhoan}`).set('Authorization', `Bearer ${token}`);
    expect(detail.body.data.VAI_TRO.TenVaiTro).toBe(ROLE_NAMES.ADMIN);
    expect(JSON.stringify(detail.body.data)).not.toContain('MatKhau');
  });
});

describe('SoDienThoai validation on admin create/update uses the shared phone rule', () => {
  const INVALID = [
    'abcdefgh',
    '09012abc567',
    '1234567',
    '123456',
    '1234567890123456',
    '+' + '1'.repeat(16),
    '090 123 4567',
    '',
    '   ',
  ];

  const adminCreate = async (token: string, SoDienThoai: unknown) => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
    return request(app)
      .post('/api/admin/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        TenDangNhap: `phone_admin_${suffix}`,
        Email: `phone_admin_${suffix}@example.com`,
        MatKhau: 'Test@12345',
        HoTen: 'Phone Rule',
        SoDienThoai,
        MaVaiTro: await getRoleId(ROLE_NAMES.CUSTOMER),
      });
  };

  const adminUpdate = (token: string, maTaiKhoan: number, body: Record<string, unknown>) =>
    request(app).patch(`/api/admin/accounts/${maTaiKhoan}`).set('Authorization', `Bearer ${token}`).send(body);

  const storedPhone = async (maTaiKhoan: number) =>
    (await getPrismaClient().tAI_KHOAN.findUnique({ where: { MaTaiKhoan: maTaiKhoan } }))?.SoDienThoai;

  it('create: accepts 0901234567 and +84901234567', async () => {
    const { token } = await makeAdminToken();
    for (const phone of ['0901234567', '+84901234567']) {
      const res = await adminCreate(token, phone);
      expect(res.status, phone).toBe(201);
      expect(res.body.data.SoDienThoai, phone).toBe(phone);
      createdAccountIds.push(res.body.data.MaTaiKhoan);
    }
  });

  it('create: trims leading/trailing whitespace before storing', async () => {
    const { token } = await makeAdminToken();
    const res = await adminCreate(token, '  0901234567  ');
    expect(res.status).toBe(201);
    expect(res.body.data.SoDienThoai).toBe('0901234567');
    expect(await storedPhone(res.body.data.MaTaiKhoan)).toBe('0901234567');
    createdAccountIds.push(res.body.data.MaTaiKhoan);
  });

  it('create: rejects abcdefgh, 09012abc567, <8 digits and >15 digits with 400, and creates nothing', async () => {
    const { token } = await makeAdminToken();
    const prisma = getPrismaClient();
    const before = await prisma.tAI_KHOAN.count();
    for (const phone of INVALID) {
      const res = await adminCreate(token, phone);
      expect(res.status, JSON.stringify(phone)).toBe(400);
    }
    expect((await adminCreate(token, 901234567)).status).toBe(400);
    expect(await prisma.tAI_KHOAN.count()).toBe(before);
  });

  it('update: accepts valid numbers (trimmed) and persists them', async () => {
    const { token } = await makeAdminToken();
    const { account } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);

    for (const [input, stored] of [
      ['0987654321', '0987654321'],
      ['+84987654321', '+84987654321'],
      ['  0912345678  ', '0912345678'],
    ]) {
      const res = await adminUpdate(token, account.MaTaiKhoan, { SoDienThoai: input });
      expect(res.status, input).toBe(200);
      expect(res.body.data.SoDienThoai, input).toBe(stored);
      expect(await storedPhone(account.MaTaiKhoan), input).toBe(stored);
    }
  });

  it('update: rejects invalid numbers with 400 and leaves the stored number (and other fields) untouched', async () => {
    const { token } = await makeAdminToken();
    const { account } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);
    const before = await storedPhone(account.MaTaiKhoan);

    for (const phone of INVALID) {
      // Yêu cầu bị từ chối thì không áp dụng trường nào
      const res = await adminUpdate(token, account.MaTaiKhoan, { SoDienThoai: phone, HoTen: 'Should Not Be Saved' });
      expect(res.status, JSON.stringify(phone)).toBe(400);
    }
    expect((await adminUpdate(token, account.MaTaiKhoan, { SoDienThoai: 901234567 })).status).toBe(400);

    const row = await getPrismaClient().tAI_KHOAN.findUnique({ where: { MaTaiKhoan: account.MaTaiKhoan } });
    expect(row?.SoDienThoai).toBe(before);
    expect(row?.HoTen).toBe(account.HoTen);
  });

  it('update: omitting SoDienThoai still works and leaves the stored number as is', async () => {
    const { token } = await makeAdminToken();
    const { account } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);
    const before = await storedPhone(account.MaTaiKhoan);

    const res = await adminUpdate(token, account.MaTaiKhoan, { HoTen: 'Name Only' });

    expect(res.status).toBe(200);
    expect(res.body.data.HoTen).toBe('Name Only');
    expect(await storedPhone(account.MaTaiKhoan)).toBe(before);
  });
});
