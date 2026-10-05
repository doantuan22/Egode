import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  createTestAccount,
  deleteTestAccount,
  createTestDiaPhuong,
  deleteTestDiaPhuong,
  createTestHotel,
  deleteTestHotel,
  createTestCancellationPolicy,
  deleteTestCancellationPolicy,
  createTestBookingDirect,
  createTestPayment,
  createTestRefund,
} from '../../test/factories';
import { getPrismaClient } from '../../config/prisma';
import { ROLE_NAMES } from '../../common/constants/roles';
import { BOOKING_STATUS } from '../../common/constants/hotel-status';
import { PAYMENT_STATUS, REFUND_STATUS } from '../../common/constants/payment';

const addDays = (days: number): Date => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

const loginAndGetToken = async (email: string, password: string) => {
  const res = await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password });
  return res.body.data.accessToken as string;
};

const accountIds: number[] = [];
const diaPhuongIds: number[] = [];
const hotelIds: number[] = [];
const policyIds: number[] = [];

let hotelId: number;
let policyId: number;
let customerId: number;
let adminToken: string;
let customerToken: string;
let ownerToken: string;

beforeAll(async () => {
  const admin = await createTestAccount({ role: ROLE_NAMES.ADMIN });
  accountIds.push(admin.account.MaTaiKhoan);
  adminToken = await loginAndGetToken(admin.account.Email, admin.plainPassword);

  const owner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  accountIds.push(owner.account.MaTaiKhoan);
  ownerToken = await loginAndGetToken(owner.account.Email, owner.plainPassword);

  const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(customer.account.MaTaiKhoan);
  customerId = customer.account.MaTaiKhoan;
  customerToken = await loginAndGetToken(customer.account.Email, customer.plainPassword);

  const diaPhuong = await createTestDiaPhuong();
  diaPhuongIds.push(diaPhuong.MaDiaPhuong);
  const hotel = await createTestHotel(owner.account.MaTaiKhoan, diaPhuong.MaDiaPhuong);
  hotelIds.push(hotel.MaKhachSan);
  hotelId = hotel.MaKhachSan;

  const policy = await createTestCancellationPolicy([{ soGioTruocNhanPhong: 24, tyLeHoanTien: 50 }]);
  policyIds.push(policy.MaChinhSachHuy);
  policyId = policy.MaChinhSachHuy;
});

afterAll(async () => {
  const prisma = getPrismaClient();
  await prisma.hOAN_TIEN.deleteMany({ where: { THANH_TOAN: { DAT_PHONG: { MaKhachSan: hotelId } } } });
  await prisma.tHANH_TOAN.deleteMany({ where: { DAT_PHONG: { MaKhachSan: hotelId } } });
  await prisma.dAT_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });

  await Promise.all(policyIds.map((id) => deleteTestCancellationPolicy(id)));
  await Promise.all(hotelIds.map((id) => deleteTestHotel(id)));
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await Promise.all(diaPhuongIds.map((id) => deleteTestDiaPhuong(id)));
});

describe('GET /admin/analytics — RBAC', () => {
  it('401 when not authenticated', async () => {
    const res = await request(app).get('/api/admin/analytics');
    expect(res.status).toBe(401);
  });

  it('403 for a customer token', async () => {
    const res = await request(app).get('/api/admin/analytics').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('403 for an owner (Chủ khách sạn) token', async () => {
    const res = await request(app).get('/api/admin/analytics').set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(403);
  });

  it('200 for an admin token, with system-wide account/hotel/booking counts', async () => {
    const res = await request(app).get('/api/admin/analytics').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.TongTaiKhoan).toBeGreaterThanOrEqual(3); // at least the 3 fixture accounts
    expect(res.body.data.TongKhachSan).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /admin/analytics — system-wide revenue/refund correctness and date range', () => {
  it('excludes cancelled/failed-payment bookings from DoanhThuHeThong, and reflects refunds in DoanhThuThucNhan', async () => {
    const oldDate = new Date('2021-06-15T00:00:00.000Z');

    const paid = await createTestBookingDirect(customerId, hotelId, policyId, addDays(10), addDays(12), {
      trangThai: BOOKING_STATUS.CONFIRMED,
      tongTienPhong: 1_500_000,
    });
    const payment = await createTestPayment(paid.MaDatPhong, 1_500_000, PAYMENT_STATUS.SUCCESS, undefined, oldDate);
    await createTestRefund(payment.MaThanhToan, 400_000, REFUND_STATUS.SUCCESS, oldDate, oldDate);

    const cancelled = await createTestBookingDirect(customerId, hotelId, policyId, addDays(10), addDays(12), {
      trangThai: BOOKING_STATUS.CANCELLED,
      tongTienPhong: 9_000_000,
    });

    const outsideRange = await request(app)
      .get('/api/admin/analytics')
      .query({ from: '2000-01-01', to: '2000-12-31' })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(outsideRange.body.data.DoanhThuHeThong).toBe(0);
    expect(outsideRange.body.data.TongHoanTien).toBe(0);

    const insideRange = await request(app)
      .get('/api/admin/analytics')
      .query({ from: '2021-06-01', to: '2021-06-30' })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(insideRange.body.data.DoanhThuHeThong).toBe(1_500_000);
    expect(insideRange.body.data.TongHoanTien).toBe(400_000);
    expect(insideRange.body.data.DoanhThuThucNhan).toBe(1_100_000);

    void cancelled;
  });
});

describe('GET /admin/analytics — review/support breakdowns', () => {
  it('includes DanhGiaTheoTrangThai (all-time) and YeuCauHoTroTheoTrangThai (date-filterable) keys', async () => {
    const res = await request(app).get('/api/admin/analytics').set('Authorization', `Bearer ${adminToken}`);
    expect(Array.isArray(res.body.data.DanhGiaTheoTrangThai)).toBe(true);
    expect(Array.isArray(res.body.data.YeuCauHoTroTheoTrangThai)).toBe(true);
    expect(Array.isArray(res.body.data.ThanhToanTheoTrangThai)).toBe(true);
    expect(Array.isArray(res.body.data.HoanTienTheoTrangThai)).toBe(true);
  });
});

describe('GET /admin/analytics — date range validation (BUG-007)', () => {
  const get = (query: Record<string, string>) =>
    request(app).get('/api/admin/analytics').query(query).set('Authorization', `Bearer ${adminToken}`);

  it('rejects an inverted range (from after to) with 400 instead of silently reporting an empty period', async () => {
    const res = await get({ from: '2021-06-30', to: '2021-06-01' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.details[0].field).toBe("from");
    expect(res.body.data).toBeUndefined();
  });

  it('still accepts a one-day range (from == to), an open-ended range, and no range at all', async () => {
    expect((await get({ from: '2021-06-15', to: '2021-06-15' })).status).toBe(200);
    expect((await get({ from: '2021-06-15' })).status).toBe(200);
    expect((await get({ to: '2021-06-15' })).status).toBe(200);
    expect((await get({})).status).toBe(200);
  });

  it('still rejects an unparseable date with 400', async () => {
    expect((await get({ to: 'not-a-date' })).status).toBe(400);
  });
});
