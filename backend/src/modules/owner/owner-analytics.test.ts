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
  createTestRoomType,
  createTestCancellationPolicy,
  deleteTestCancellationPolicy,
  createTestBookingDirect,
  createTestPayment,
  createTestRefund,
} from '../../test/factories';
import { getPrismaClient } from '../../config/prisma';
import { ROLE_NAMES } from '../../common/constants/roles';
import { BOOKING_STATUS, ROOM_RATE_STATUS } from '../../common/constants/hotel-status';
import { PAYMENT_STATUS, REFUND_STATUS } from '../../common/constants/payment';

const addDays = (days: number): Date => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);

const loginAndGetToken = async (email: string, password: string) => {
  const res = await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password });
  return res.body.data.accessToken as string;
};

const accountIds: number[] = [];
const diaPhuongIds: number[] = [];
const hotelIds: number[] = [];
const policyIds: number[] = [];

let hotelAId: number;
let policyId: number;
let customerId: number;
let ownerAToken: string;
let ownerBToken: string;
let customerToken: string;

beforeAll(async () => {
  const ownerA = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  accountIds.push(ownerA.account.MaTaiKhoan);
  ownerAToken = await loginAndGetToken(ownerA.account.Email, ownerA.plainPassword);

  const ownerB = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  accountIds.push(ownerB.account.MaTaiKhoan);
  ownerBToken = await loginAndGetToken(ownerB.account.Email, ownerB.plainPassword);

  const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(customer.account.MaTaiKhoan);
  customerId = customer.account.MaTaiKhoan;
  customerToken = await loginAndGetToken(customer.account.Email, customer.plainPassword);

  const diaPhuong = await createTestDiaPhuong();
  diaPhuongIds.push(diaPhuong.MaDiaPhuong);
  const hotelA = await createTestHotel(ownerA.account.MaTaiKhoan, diaPhuong.MaDiaPhuong);
  hotelIds.push(hotelA.MaKhachSan);
  hotelAId = hotelA.MaKhachSan;
  const hotelB = await createTestHotel(ownerB.account.MaTaiKhoan, diaPhuong.MaDiaPhuong);
  hotelIds.push(hotelB.MaKhachSan);

  const policy = await createTestCancellationPolicy([{ soGioTruocNhanPhong: 24, tyLeHoanTien: 50 }]);
  policyIds.push(policy.MaChinhSachHuy);
  policyId = policy.MaChinhSachHuy;
});

afterAll(async () => {
  const prisma = getPrismaClient();
  await prisma.hOAN_TIEN.deleteMany({ where: { THANH_TOAN: { DAT_PHONG: { MaKhachSan: { in: hotelIds } } } } });
  await prisma.tHANH_TOAN.deleteMany({ where: { DAT_PHONG: { MaKhachSan: { in: hotelIds } } } });
  await prisma.cHI_TIET_DAT_PHONG.deleteMany({ where: { DAT_PHONG: { MaKhachSan: { in: hotelIds } } } });
  await prisma.dAT_PHONG.deleteMany({ where: { MaKhachSan: { in: hotelIds } } });

  await Promise.all(policyIds.map((id) => deleteTestCancellationPolicy(id)));
  await Promise.all(hotelIds.map((id) => deleteTestHotel(id)));
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await Promise.all(diaPhuongIds.map((id) => deleteTestDiaPhuong(id)));
});

describe('GET /owner/hotels/:id/analytics — ownership', () => {
  it('401 when not authenticated', async () => {
    const res = await request(app).get(`/api/owner/hotels/${hotelAId}/analytics`);
    expect(res.status).toBe(401);
  });

  it('403 when the role is not Chủ khách sạn', async () => {
    const res = await request(app).get(`/api/owner/hotels/${hotelAId}/analytics`).set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('404 for a non-existent hotel', async () => {
    const res = await request(app).get('/api/owner/hotels/999999999/analytics').set('Authorization', `Bearer ${ownerAToken}`);
    expect(res.status).toBe(404);
  });

  it("403 when Owner B requests Owner A's hotel analytics", async () => {
    const res = await request(app).get(`/api/owner/hotels/${hotelAId}/analytics`).set('Authorization', `Bearer ${ownerBToken}`);
    expect(res.status).toBe(403);
  });

  it('200 for the owning owner', async () => {
    const res = await request(app).get(`/api/owner/hotels/${hotelAId}/analytics`).set('Authorization', `Bearer ${ownerAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.MaKhachSan).toBe(hotelAId);
  });
});

describe('GET /owner/hotels/:id/analytics — revenue correctness', () => {
  it('never counts a cancelled booking (no payment) or a failed payment toward revenue, and refunds reduce net revenue', async () => {
    const confirmed = await createTestBookingDirect(customerId, hotelAId, policyId, addDays(10), addDays(12), {
      trangThai: BOOKING_STATUS.CONFIRMED,
      tongTienPhong: 1_000_000,
    });
    const successPayment = await createTestPayment(confirmed.MaDatPhong, 1_000_000, PAYMENT_STATUS.SUCCESS);
    await createTestRefund(successPayment.MaThanhToan, 300_000, REFUND_STATUS.SUCCESS);

    const cancelledNeverPaid = await createTestBookingDirect(customerId, hotelAId, policyId, addDays(10), addDays(12), {
      trangThai: BOOKING_STATUS.CANCELLED,
      tongTienPhong: 5_000_000, // large, to make it obvious if wrongly counted
    });

    const confirmedFailedPayment = await createTestBookingDirect(customerId, hotelAId, policyId, addDays(10), addDays(12), {
      trangThai: BOOKING_STATUS.PENDING_PAYMENT,
      tongTienPhong: 7_000_000,
    });
    await createTestPayment(confirmedFailedPayment.MaDatPhong, 7_000_000, PAYMENT_STATUS.FAILED);

    const res = await request(app).get(`/api/owner/hotels/${hotelAId}/analytics`).set('Authorization', `Bearer ${ownerAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.DoanhThuGop).toBe(1_000_000);
    expect(res.body.data.TongHoanTien).toBe(300_000);
    expect(res.body.data.DoanhThuThucNhan).toBe(700_000);

    const statusCounts: Array<{ TrangThai: string; SoLuong: number }> = res.body.data.BookingTheoTrangThai;
    const cancelledCount = statusCounts.find((s) => s.TrangThai === BOOKING_STATUS.CANCELLED)?.SoLuong ?? 0;
    expect(cancelledCount).toBeGreaterThanOrEqual(1); // the cancelled booking is still counted as a booking, just not as revenue

    void cancelledNeverPaid;
  });
});

describe('GET /owner/hotels/:id/analytics — date range', () => {
  it('only counts payments whose ThoiGianGiaoDich falls inside [from, to]', async () => {
    const booking = await createTestBookingDirect(customerId, hotelAId, policyId, addDays(20), addDays(22), {
      trangThai: BOOKING_STATUS.CONFIRMED,
      tongTienPhong: 2_000_000,
    });
    const oldDate = new Date('2020-01-15T00:00:00.000Z');
    await createTestPayment(booking.MaDatPhong, 2_000_000, PAYMENT_STATUS.SUCCESS, undefined, oldDate);

    const outsideRange = await request(app)
      .get(`/api/owner/hotels/${hotelAId}/analytics`)
      .query({ from: '2000-01-01', to: '2000-12-31' })
      .set('Authorization', `Bearer ${ownerAToken}`);
    expect(outsideRange.body.data.DoanhThuGop).toBe(0);

    const insideRange = await request(app)
      .get(`/api/owner/hotels/${hotelAId}/analytics`)
      .query({ from: '2020-01-01', to: '2020-01-31' })
      .set('Authorization', `Bearer ${ownerAToken}`);
    expect(insideRange.body.data.DoanhThuGop).toBe(2_000_000);
  });
});

describe('GET /owner/hotels/:id/analytics — date range validation (BUG-007)', () => {
  const get = (query: Record<string, string>) =>
    request(app).get(`/api/owner/hotels/${hotelAId}/analytics`).query(query).set('Authorization', `Bearer ${ownerAToken}`);

  it('rejects an inverted range (from after to) with 400 instead of silently reporting an empty period', async () => {
    const res = await get({ from: '2020-01-31', to: '2020-01-01' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.details[0].field).toBe("from");
    expect(res.body.data).toBeUndefined();
  });

  it('still accepts a one-day range (from == to), an open-ended range, and no range at all', async () => {
    expect((await get({ from: '2020-01-15', to: '2020-01-15' })).status).toBe(200);
    expect((await get({ from: '2020-01-15' })).status).toBe(200);
    expect((await get({ to: '2020-01-15' })).status).toBe(200);
    expect((await get({})).status).toBe(200);
  });

  it('still rejects an unparseable date with 400', async () => {
    expect((await get({ from: 'not-a-date' })).status).toBe(400);
  });
});

describe('GET /owner/hotels/:id/analytics — room types and occupancy', () => {
  it('ranks the most-booked room type, and computes an exact occupancy rate from QUY_PHONG_GIA + CHI_TIET_DAT_PHONG', async () => {
    const prisma = getPrismaClient();
    const roomType = await createTestRoomType(hotelAId);
    const checkIn = addDays(30);
    const checkOut = addDays(32); // 2 nights
    await prisma.qUY_PHONG_GIA.createMany({
      data: [
        { MaLoaiPhong: roomType.MaLoaiPhong, NgayApDung: addDays(30), GiaPhong: 500000, SoLuongPhong: 4, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE },
        { MaLoaiPhong: roomType.MaLoaiPhong, NgayApDung: addDays(31), GiaPhong: 500000, SoLuongPhong: 4, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE },
      ],
    });

    const booking = await createTestBookingDirect(customerId, hotelAId, policyId, checkIn, checkOut, {
      trangThai: BOOKING_STATUS.CONFIRMED,
    });
    await prisma.cHI_TIET_DAT_PHONG.create({ data: { MaDatPhong: booking.MaDatPhong, MaLoaiPhong: roomType.MaLoaiPhong, SoLuongPhong: 2 } });

    // Room-type popularity is attributed by booking creation date (NgayTao, i.e. "today" in this
    // fixture), while occupancy is attributed by the stay's own calendar nights (addDays(30..31)) —
    // two different date fields by design (see analytics.repository.ts) — so the query range here
    // must cover both: today (for NgayTao) through the stay window (for occupancy).
    const res = await request(app)
      .get(`/api/owner/hotels/${hotelAId}/analytics`)
      .query({ from: iso(addDays(-1)), to: iso(addDays(31)) })
      .set('Authorization', `Bearer ${ownerAToken}`);

    expect(res.status).toBe(200);
    const top = res.body.data.LoaiPhongPhoBien.find((r: { MaLoaiPhong: number }) => r.MaLoaiPhong === roomType.MaLoaiPhong);
    expect(top?.SoLuongDaDat).toBe(2);

    // 2 rooms booked x 2 nights = 4 booked room-nights; capacity = 4 rooms x 2 nights = 8 sellable room-nights -> 50%.
    expect(res.body.data.TongPhongDem).toBe(4);
    expect(res.body.data.TongPhongCoTheBan).toBe(8);
    expect(res.body.data.TyLeLapDay).toBe(50);
  });

  it('returns null occupancy (not 0) when there is no QUY_PHONG_GIA data at all in range', async () => {
    const res = await request(app)
      .get(`/api/owner/hotels/${hotelAId}/analytics`)
      .query({ from: '2019-01-01', to: '2019-01-02' })
      .set('Authorization', `Bearer ${ownerAToken}`);
    expect(res.body.data.TyLeLapDay).toBeNull();
  });
});
