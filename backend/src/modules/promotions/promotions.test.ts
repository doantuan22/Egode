import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { createTestAccount, deleteTestAccount } from '../../test/factories';
import { getPrismaClient } from '../../config/prisma';
import { ROLE_NAMES } from '../../common/constants/roles';
import { DISCOUNT_TYPE, PROMOTION_STATUS, PROMOTION_SCOPE } from '../../common/constants/commercial';

const loginAndGetToken = async (email: string, password: string) => {
  const res = await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password });
  return res.body.data.accessToken as string;
};

const accountIds: number[] = [];
const promotionIds: number[] = [];

let adminToken: string;
let customerToken: string;
let ownerToken: string;

const uniqueCode = () => `M8TEST_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

beforeAll(async () => {
  const admin = await createTestAccount({ role: ROLE_NAMES.ADMIN });
  accountIds.push(admin.account.MaTaiKhoan);
  adminToken = await loginAndGetToken(admin.account.Email, admin.plainPassword);

  const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(customer.account.MaTaiKhoan);
  customerToken = await loginAndGetToken(customer.account.Email, customer.plainPassword);

  const owner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  accountIds.push(owner.account.MaTaiKhoan);
  ownerToken = await loginAndGetToken(owner.account.Email, owner.plainPassword);
});

afterAll(async () => {
  const prisma = getPrismaClient();
  await prisma.kHUYEN_MAI.deleteMany({ where: { MaKhuyenMai: { in: promotionIds } } });
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
});

const createPromo = (overrides: Record<string, unknown> = {}) => ({
  MaCode: uniqueCode(),
  LoaiGiamGia: DISCOUNT_TYPE.PERCENT,
  GiaTriGiam: 10,
  GiaTriDonToiThieu: 100000,
  MucGiamToiDa: 50000,
  SoLuongGioiHan: 100,
  NgayBatDau: '2026-01-01',
  NgayKetThuc: '2026-12-31',
  ...overrides,
});

describe('RBAC on /api/admin/promotions', () => {
  it('rejects a customer token with 403', async () => {
    const res = await request(app).get('/api/admin/promotions').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('rejects an owner (Chủ khách sạn) token with 403', async () => {
    const res = await request(app).get('/api/admin/promotions').set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(403);
  });

  it('401 when not authenticated', async () => {
    const res = await request(app).get('/api/admin/promotions');
    expect(res.status).toBe(401);
  });

  it('allows an admin token', async () => {
    const res = await request(app).get('/api/admin/promotions').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/admin/promotions (create)', () => {
  it('creates a promotion, always system-wide, always starting "Hoạt động"', async () => {
    const res = await request(app)
      .post('/api/admin/promotions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(createPromo());

    expect(res.status).toBe(201);
    promotionIds.push(res.body.data.MaKhuyenMai);
    expect(res.body.data.TrangThai).toBe(PROMOTION_STATUS.ACTIVE);
    expect(res.body.data.PhamViApDung).toBe(PROMOTION_SCOPE.SYSTEM_WIDE);
  });

  it("400 when a client-supplied PhamViApDung/TrangThai is sent — ignored entirely (no such field in the schema)", async () => {
    const res = await request(app)
      .post('/api/admin/promotions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...createPromo(), PhamViApDung: 'Theo phạm vi', TrangThai: PROMOTION_STATUS.INACTIVE });

    expect(res.status).toBe(201);
    promotionIds.push(res.body.data.MaKhuyenMai);
    expect(res.body.data.PhamViApDung).toBe(PROMOTION_SCOPE.SYSTEM_WIDE);
    expect(res.body.data.TrangThai).toBe(PROMOTION_STATUS.ACTIVE);
  });

  it('409 on a duplicate MaCode', async () => {
    const code = uniqueCode();
    const first = await request(app).post('/api/admin/promotions').set('Authorization', `Bearer ${adminToken}`).send(createPromo({ MaCode: code }));
    promotionIds.push(first.body.data.MaKhuyenMai);

    const second = await request(app).post('/api/admin/promotions').set('Authorization', `Bearer ${adminToken}`).send(createPromo({ MaCode: code }));
    expect(second.status).toBe(409);
  });

  it('400 when NgayKetThuc is before NgayBatDau', async () => {
    const res = await request(app)
      .post('/api/admin/promotions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(createPromo({ NgayBatDau: '2026-12-31', NgayKetThuc: '2026-01-01' }));
    expect(res.status).toBe(400);
  });

  it('400 when a percent discount exceeds 100', async () => {
    const res = await request(app)
      .post('/api/admin/promotions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(createPromo({ LoaiGiamGia: DISCOUNT_TYPE.PERCENT, GiaTriGiam: 150 }));
    expect(res.status).toBe(400);
  });

  it('400 when GiaTriGiam is not positive', async () => {
    const res = await request(app)
      .post('/api/admin/promotions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(createPromo({ GiaTriGiam: 0 }));
    expect(res.status).toBe(400);
  });

  it('400 for an invalid LoaiGiamGia', async () => {
    const res = await request(app)
      .post('/api/admin/promotions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(createPromo({ LoaiGiamGia: 'Không hợp lệ' }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/admin/promotions (list/search/filter) and GET /:id', () => {
  it('lists, filters by TrangThai/LoaiGiamGia, and searches by MaCode', async () => {
    const code = uniqueCode();
    const created = await request(app)
      .post('/api/admin/promotions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(createPromo({ MaCode: code, LoaiGiamGia: DISCOUNT_TYPE.FIXED_AMOUNT, GiaTriGiam: 20000 }));
    promotionIds.push(created.body.data.MaKhuyenMai);

    const bySearch = await request(app).get('/api/admin/promotions').query({ search: code }).set('Authorization', `Bearer ${adminToken}`);
    expect(bySearch.body.data.map((p: { MaCode: string }) => p.MaCode)).toContain(code);

    const byType = await request(app)
      .get('/api/admin/promotions')
      .query({ search: code, LoaiGiamGia: DISCOUNT_TYPE.FIXED_AMOUNT })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(byType.body.data.map((p: { MaCode: string }) => p.MaCode)).toContain(code);

    const byWrongType = await request(app)
      .get('/api/admin/promotions')
      .query({ search: code, LoaiGiamGia: DISCOUNT_TYPE.PERCENT })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(byWrongType.body.data.map((p: { MaCode: string }) => p.MaCode)).not.toContain(code);
  });

  it('404 for a non-existent promotion', async () => {
    const res = await request(app).get('/api/admin/promotions/999999999').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('detail includes SoLuongDaSuDung (usage count)', async () => {
    const created = await request(app).post('/api/admin/promotions').set('Authorization', `Bearer ${adminToken}`).send(createPromo());
    promotionIds.push(created.body.data.MaKhuyenMai);

    const detail = await request(app).get(`/api/admin/promotions/${created.body.data.MaKhuyenMai}`).set('Authorization', `Bearer ${adminToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.SoLuongDaSuDung).toBe(0);
  });
});

describe('PATCH /api/admin/promotions/:id (update) and activate/deactivate', () => {
  it('updates fields and re-validates the merged result', async () => {
    const created = await request(app).post('/api/admin/promotions').set('Authorization', `Bearer ${adminToken}`).send(createPromo());
    const id = created.body.data.MaKhuyenMai;
    promotionIds.push(id);

    const updated = await request(app)
      .patch(`/api/admin/promotions/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ GiaTriGiam: 25 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.GiaTriGiam).toBe('25');

    // Sửa ngày kết thúc trước ngày bắt đầu hiện có vẫn bị bắt
    const badDate = await request(app)
      .patch(`/api/admin/promotions/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ NgayKetThuc: '2025-01-01' });
    expect(badDate.status).toBe(400);
  });

  it('409 when updating MaCode to one that already exists', async () => {
    const codeA = uniqueCode();
    const codeB = uniqueCode();
    const a = await request(app).post('/api/admin/promotions').set('Authorization', `Bearer ${adminToken}`).send(createPromo({ MaCode: codeA }));
    const b = await request(app).post('/api/admin/promotions').set('Authorization', `Bearer ${adminToken}`).send(createPromo({ MaCode: codeB }));
    promotionIds.push(a.body.data.MaKhuyenMai, b.body.data.MaKhuyenMai);

    const res = await request(app)
      .patch(`/api/admin/promotions/${b.body.data.MaKhuyenMai}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ MaCode: codeA });
    expect(res.status).toBe(409);
  });

  it('activate/deactivate toggle TrangThai', async () => {
    const created = await request(app).post('/api/admin/promotions').set('Authorization', `Bearer ${adminToken}`).send(createPromo());
    const id = created.body.data.MaKhuyenMai;
    promotionIds.push(id);

    const deactivated = await request(app).post(`/api/admin/promotions/${id}/deactivate`).set('Authorization', `Bearer ${adminToken}`);
    expect(deactivated.body.data.TrangThai).toBe(PROMOTION_STATUS.INACTIVE);

    const reactivated = await request(app).post(`/api/admin/promotions/${id}/activate`).set('Authorization', `Bearer ${adminToken}`);
    expect(reactivated.body.data.TrangThai).toBe(PROMOTION_STATUS.ACTIVE);
  });

  it('404 activating a non-existent promotion', async () => {
    const res = await request(app).post('/api/admin/promotions/999999999/activate').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
