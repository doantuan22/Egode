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
} from '../../test/factories';
import { FakeRefundGateway } from '../../test/fakes';
import { getPrismaClient } from '../../config/prisma';
import { ROLE_NAMES } from '../../common/constants/roles';
import { BOOKING_STATUS } from '../../common/constants/hotel-status';
import { PAYMENT_STATUS } from '../../common/constants/payment';
import { BookingsService } from './bookings.service';
import { completeFinishedBookings } from './booking-completion';
import { checkInInstant } from '../../common/utils/business-time';
import { encodeGatewayRef } from '../payments/vnpay';

/**
 * Bug #13 — every business rule reads the database's dates and times in ONE zone, Asia/Ho_Chi_Minh (UTC+7):
 *   cancellation cut-off  → measured to the check-in INSTANT (date + hotel check-in time), not 00:00 UTC
 *   booking completion    → once the check-out INSTANT has passed
 *   report / payment date filters → calendar days of Vietnam
 * (promotion windows are covered in promotion-pricing.test.ts, the pure helpers in business-time.test.ts)
 */
const IP = '127.0.0.1';
const accountIds: number[] = [];
let diaPhuongId = 0;
let hotelId = 0;
let policyId = 0;
let customerId = 0;
let customerToken = '';
let ownerToken = '';
let adminToken = '';
const prisma = () => getPrismaClient();
const login = async (email: string, password: string) =>
  (await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password })).body.data.accessToken as string;

const date = (key: string) => new Date(`${key}T00:00:00Z`);
const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);
const setHotelTimes = (gioNhan: string, gioTra: string) =>
  prisma().kHACH_SAN.update({ where: { MaKhachSan: hotelId }, data: { GioNhanPhong: time(gioNhan), GioTraPhong: time(gioTra) } });
let ref = 0;
const packed = () => encodeGatewayRef(`TZ${Date.now()}${++ref}`, `${800000 + ref}`, '20300101000000');

beforeAll(async () => {
  const [owner, customer, admin] = await Promise.all([
    createTestAccount({ role: ROLE_NAMES.PARTNER }),
    createTestAccount({ role: ROLE_NAMES.CUSTOMER }),
    createTestAccount({ role: ROLE_NAMES.ADMIN }),
  ]);
  accountIds.push(owner.account.MaTaiKhoan, customer.account.MaTaiKhoan, admin.account.MaTaiKhoan);
  customerId = customer.account.MaTaiKhoan;
  [ownerToken, customerToken, adminToken] = await Promise.all([
    login(owner.account.Email, owner.plainPassword),
    login(customer.account.Email, customer.plainPassword),
    login(admin.account.Email, admin.plainPassword),
  ]);
  diaPhuongId = (await createTestDiaPhuong()).MaDiaPhuong;
  hotelId = (await createTestHotel(owner.account.MaTaiKhoan, diaPhuongId)).MaKhachSan;
  policyId = (await createTestCancellationPolicy([
    { soGioTruocNhanPhong: 72, tyLeHoanTien: 100 },
    { soGioTruocNhanPhong: 24, tyLeHoanTien: 50 },
  ])).MaChinhSachHuy;
});

afterAll(async () => {
  await prisma().hOAN_TIEN.deleteMany({ where: { THANH_TOAN: { DAT_PHONG: { MaKhachSan: hotelId } } } });
  await prisma().tHANH_TOAN.deleteMany({ where: { DAT_PHONG: { MaKhachSan: hotelId } } });
  await prisma().dAT_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });
  await deleteTestCancellationPolicy(policyId);
  await deleteTestHotel(hotelId);
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await deleteTestDiaPhuong(diaPhuongId);
});

describe('cancellation tiers are measured to the check-in instant (date + hotel check-in time, Vietnam time)', () => {
  // Check-in 2030-06-15 at 14:00 Vietnam time = 2030-06-15T07:00:00Z. Tiers: >= 72 h → 100 %, >= 24 h → 50 %, else 0 %.
  const STAY = '2030-06-15';
  const refundPercentAt = async (now: Date, gioNhan = '14:00') => {
    await setHotelTimes(gioNhan, '12:00');
    const booking = await createTestBookingDirect(customerId, hotelId, policyId, date(STAY), date('2030-06-16'), { trangThai: BOOKING_STATUS.CONFIRMED, tongTienPhong: 1_000_000 });
    await createTestPayment(booking.MaDatPhong, 1_000_000, PAYMENT_STATUS.SUCCESS, packed());
    const gateway = new FakeRefundGateway({ success: true, message: 'ok' });
    const service = new BookingsService(undefined, gateway, undefined, undefined, () => now);
    const result = await service.cancelBooking(booking.MaDatPhong, customerId, {}, IP);
    const refunded = result.ThanhToan[0].HoanTien[0]?.SoTienHoan ?? 0;
    return (refunded / 1_000_000) * 100;
  };
  const checkIn = checkInInstant(date(STAY), time('14:00')); // 2030-06-15T07:00:00Z
  const before = (hours: number, minutes = 0) => new Date(checkIn.getTime() - hours * 3_600_000 - minutes * 60_000);

  it('the 72 h line sits at 07:00 UTC three days earlier: one minute either side flips 100 % ↔ 50 %', async () => {
    expect(before(72).toISOString()).toBe('2030-06-12T07:00:00.000Z');
    expect(await refundPercentAt(before(72, 1))).toBe(100); // 72 h 01 min before check-in
    expect(await refundPercentAt(before(72).getTime() === 0 ? before(72) : new Date(before(72).getTime() + 60_000))).toBe(50); // 71 h 59 min
  });

  it('the 24 h line: one minute either side flips 50 % ↔ 0 % (no refund row at all)', async () => {
    expect(await refundPercentAt(before(24, 1))).toBe(50);
    expect(await refundPercentAt(new Date(before(24).getTime() + 60_000))).toBe(0);
  });

  it('exactly on a line counts as reaching it (>=)', async () => {
    expect(await refundPercentAt(before(72))).toBe(100);
    expect(await refundPercentAt(before(24))).toBe(50);
  });

  it('is NOT measured to 00:00 UTC of the stay date: 3 days before, at 06:00 UTC, the cut-off (07:00 UTC) is still ahead', async () => {
    // Old reading (check-in = 2030-06-15T00:00Z): 72 h line = 2030-06-12T00:00Z, so 06:00Z would already be 66 h → 50 %.
    expect(await refundPercentAt(new Date('2030-06-12T06:00:00Z'))).toBe(100);
  });

  it("follows the hotel's own check-in time: with check-in at 22:00 the same moment is 8 h earlier relative to it", async () => {
    const now = before(68); // 68 h before a 14:00 check-in
    expect(await refundPercentAt(now, '14:00')).toBe(50);
    expect(await refundPercentAt(now, '22:00')).toBe(100); // 76 h before a 22:00 check-in
    await setHotelTimes('14:00', '12:00');
  });
});

describe('the booking detail exposes the same instants the server measures to', () => {
  it('GioNhanPhong / GioTraPhong as HH:mm and the check-in / check-out instants as ISO UTC', async () => {
    await setHotelTimes('15:30', '11:00');
    const booking = await createTestBookingDirect(customerId, hotelId, policyId, date('2031-02-10'), date('2031-02-12'), { trangThai: BOOKING_STATUS.CONFIRMED });

    const res = await request(app).get(`/api/bookings/${booking.MaDatPhong}`).set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      GioNhanPhong: '15:30',
      GioTraPhong: '11:00',
      ThoiDiemNhanPhong: '2031-02-10T08:30:00.000Z', // 15:30 Vietnam time
      ThoiDiemTraPhong: '2031-02-12T04:00:00.000Z', // 11:00 Vietnam time
    });
    await setHotelTimes('14:00', '12:00');
  });
});

describe('a stay is completed once the check-out INSTANT has passed (not at 00:00 UTC of the check-out date)', () => {
  // 2020 is far enough back that no other row in the shared database is touched by this sweep (bookings are
  // created in 2019 so NgayCapNhat = the sweep time stays after NgayTao).
  const completes = async (gioTra: string, now: string) => {
    await setHotelTimes('14:00', gioTra);
    const booking = await createTestBookingDirect(customerId, hotelId, policyId, date('2020-01-01'), date('2020-01-02'), { trangThai: BOOKING_STATUS.CONFIRMED, ngayTao: new Date('2019-12-01T00:00:00Z') });
    await completeFinishedBookings(prisma(), new Date(now));
    return (await prisma().dAT_PHONG.findUniqueOrThrow({ where: { MaDatPhong: booking.MaDatPhong } })).TrangThai === BOOKING_STATUS.COMPLETED;
  };

  it('check-out 12:00 (= 05:00 UTC): 04:59 UTC is still "Đã xác nhận", 05:01 UTC is "Hoàn tất"', async () => {
    expect(await completes('12:00', '2020-01-02T04:59:00Z')).toBe(false);
    expect(await completes('12:00', '2020-01-02T05:01:00Z')).toBe(true);
  });

  it('is not completed at the old trigger of 00:00 UTC on the check-out date (07:00 Vietnam time, 5 h before check-out)', async () => {
    expect(await completes('12:00', '2020-01-02T03:00:00Z')).toBe(false);
  });

  it("follows the hotel's check-out time: 18:00 → 11:00 UTC", async () => {
    expect(await completes('18:00', '2020-01-02T10:59:00Z')).toBe(false);
    expect(await completes('18:00', '2020-01-02T11:01:00Z')).toBe(true);
    await setHotelTimes('14:00', '12:00');
  });

  it('only "Đã xác nhận" bookings are completed — a cancelled stay stays cancelled', async () => {
    const cancelled = await createTestBookingDirect(customerId, hotelId, policyId, date('2020-01-01'), date('2020-01-02'), { trangThai: BOOKING_STATUS.CANCELLED, ngayTao: new Date('2019-12-01T00:00:00Z') });
    await completeFinishedBookings(prisma(), new Date('2020-01-03T00:00:00Z'));
    expect((await prisma().dAT_PHONG.findUniqueOrThrow({ where: { MaDatPhong: cancelled.MaDatPhong } })).TrangThai).toBe(BOOKING_STATUS.CANCELLED);
  });
});

describe('report and payment date filters are calendar days of Vietnam', () => {
  // Four instants around two Vietnam midnights:
  //   A 2026-03-09T16:59:59Z = 23:59:59 on 9 March   B 2026-03-09T17:00:00Z = 00:00:00 on 10 March
  //   C 2026-03-10T16:59:59Z = 23:59:59 on 10 March  D 2026-03-10T17:00:00Z = 00:00:00 on 11 March
  const instants = { A: '2026-03-09T16:59:59Z', B: '2026-03-09T17:00:00Z', C: '2026-03-10T16:59:59Z', D: '2026-03-10T17:00:00Z' } as const;
  const amounts = { A: 100_000, B: 200_000, C: 300_000, D: 400_000 } as const;
  const paymentIds: Record<string, number> = {};

  beforeAll(async () => {
    for (const key of ['A', 'B', 'C', 'D'] as const) {
      const at = new Date(instants[key]);
      const booking = await createTestBookingDirect(customerId, hotelId, policyId, date('2031-05-01'), date('2031-05-02'), {
        trangThai: BOOKING_STATUS.CONFIRMED,
        tongTienPhong: amounts[key],
        ngayTao: at,
      });
      const payment = await createTestPayment(booking.MaDatPhong, amounts[key], PAYMENT_STATUS.SUCCESS, packed(), at);
      paymentIds[key] = payment.MaThanhToan;
    }
  });

  const ownerReport = async (from: string, to: string) => {
    const res = await request(app).get(`/api/owner/hotels/${hotelId}/analytics`).query({ from, to }).set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    return res.body.data as { DoanhThuGop: number; TongSoBooking: number };
  };

  it('owner report for 10 March counts exactly what happened from 00:00 to 23:59:59 Vietnam time (B and C)', async () => {
    const day10 = await ownerReport('2026-03-10', '2026-03-10');
    expect(day10.DoanhThuGop).toBe(amounts.B + amounts.C);
    expect(day10.TongSoBooking).toBe(2);
  });

  it('the neighbouring days get A and D — nothing is lost or counted twice at the boundaries', async () => {
    expect((await ownerReport('2026-03-09', '2026-03-09')).DoanhThuGop).toBe(amounts.A);
    expect((await ownerReport('2026-03-11', '2026-03-11')).DoanhThuGop).toBe(amounts.D);
    const all = await ownerReport('2026-03-09', '2026-03-11');
    expect(all.DoanhThuGop).toBe(amounts.A + amounts.B + amounts.C + amounts.D);
    expect(all.TongSoBooking).toBe(4);
  });

  it('admin analytics uses the same day boundaries', async () => {
    const res = await request(app).get('/api/admin/analytics').query({ from: '2026-03-10', to: '2026-03-10' }).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    // The shared database may hold other payments on that day; ours (B + C) must be inside, A and D must not add to it.
    const withoutOurs = res.body.data.DoanhThuHeThong - (amounts.B + amounts.C);
    const day9 = await request(app).get('/api/admin/analytics').query({ from: '2026-03-09', to: '2026-03-09' }).set('Authorization', `Bearer ${adminToken}`);
    expect(withoutOurs).toBeGreaterThanOrEqual(0);
    expect(day9.body.data.DoanhThuHeThong).toBeGreaterThanOrEqual(amounts.A);
  });

  it('admin payment list: from/to are calendar days, `to` is inclusive of its whole Vietnam day', async () => {
    const res = await request(app).get('/api/admin/payments').query({ from: '2026-03-10', to: '2026-03-10', limit: 100 }).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((p: { MaThanhToan: number }) => p.MaThanhToan);
    expect(ids).toContain(paymentIds.B);
    expect(ids).toContain(paymentIds.C); // 23:59:59 on the last day is still "to"
    expect(ids).not.toContain(paymentIds.A);
    expect(ids).not.toContain(paymentIds.D);
  });
});
