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
} from '../../test/factories';
import { FakeRefundGateway } from '../../test/fakes';
import { getPrismaClient } from '../../config/prisma';
import { env } from '../../config/env';
import { addDaysToDateKey, businessToday } from '../../common/utils/business-time';
import { ROLE_NAMES } from '../../common/constants/roles';
import { BOOKING_STATUS, ROOM_RATE_STATUS } from '../../common/constants/hotel-status';
import { PAYMENT_STATUS, REFUND_STATUS } from '../../common/constants/payment';
import { BookingsService } from './bookings.service';
import { BookingsRepository } from './bookings.repository';
import { PaymentsService } from '../payments/payments.service';
import { PaymentsRepository } from '../payments/payments.repository';
import { encodeGatewayRef, signVnpayParams } from '../payments/vnpay';
import { env } from '../../config/env';

// A stay date is a Vietnam calendar day; refund tiers are measured from its check-in INSTANT (date + hotel check-in time).
const addDays = (days: number): Date => new Date(`${addDaysToDateKey(businessToday(), days)}T00:00:00Z`);

const loginAndGetToken = async (email: string, password: string) => {
  const res = await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password });
  return res.body.data.accessToken as string;
};

const accountIds: number[] = [];
const diaPhuongIds: number[] = [];
const hotelIds: number[] = [];
const policyIds: number[] = [];

let hotelId: number;
/** Tiers: >=72h before check-in → 100%; >=24h → 50%; otherwise → 0%. */
let tieredPolicyId: number;
let customerId: number;
let customerToken: string;
let otherCustomerId: number;
let otherCustomerToken: string;
let ownerToken: string;

beforeAll(async () => {
  const owner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  accountIds.push(owner.account.MaTaiKhoan);
  ownerToken = await loginAndGetToken(owner.account.Email, owner.plainPassword);

  const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(customer.account.MaTaiKhoan);
  customerId = customer.account.MaTaiKhoan;
  customerToken = await loginAndGetToken(customer.account.Email, customer.plainPassword);

  const other = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(other.account.MaTaiKhoan);
  otherCustomerId = other.account.MaTaiKhoan;
  otherCustomerToken = await loginAndGetToken(other.account.Email, other.plainPassword);

  const diaPhuong = await createTestDiaPhuong();
  diaPhuongIds.push(diaPhuong.MaDiaPhuong);
  const hotel = await createTestHotel(owner.account.MaTaiKhoan, diaPhuong.MaDiaPhuong);
  hotelIds.push(hotel.MaKhachSan);
  hotelId = hotel.MaKhachSan;

  const policy = await createTestCancellationPolicy([
    { soGioTruocNhanPhong: 72, tyLeHoanTien: 100 },
    { soGioTruocNhanPhong: 24, tyLeHoanTien: 50 },
  ]);
  policyIds.push(policy.MaChinhSachHuy);
  tieredPolicyId = policy.MaChinhSachHuy;
});

afterAll(async () => {
  const prisma = getPrismaClient();
  await prisma.hOAN_TIEN.deleteMany({ where: { THANH_TOAN: { DAT_PHONG: { MaKhachSan: hotelId } } } });
  await prisma.tHANH_TOAN.deleteMany({ where: { DAT_PHONG: { MaKhachSan: hotelId } } });
  await prisma.cHI_TIET_DAT_PHONG.deleteMany({ where: { DAT_PHONG: { MaKhachSan: hotelId } } });
  await prisma.dAT_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });

  await Promise.all(policyIds.map((id) => deleteTestCancellationPolicy(id)));
  await Promise.all(hotelIds.map((id) => deleteTestHotel(id)));
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await Promise.all(diaPhuongIds.map((id) => deleteTestDiaPhuong(id)));
});

const makeBooking = (
  trangThai: string,
  checkIn: Date,
  checkOut: Date,
  opts: { tongTienPhong?: number; ownerId?: number; policyId?: number } = {}
) =>
  createTestBookingDirect(opts.ownerId ?? customerId, hotelId, opts.policyId ?? tieredPolicyId, checkIn, checkOut, {
    trangThai,
    tongTienPhong: opts.tongTienPhong ?? 1_000_000,
  });

describe('GET /bookings and GET /bookings/:id (M6 §5 — booking history/detail)', () => {
  it('GET /bookings lists only the requesting customer\'s own bookings', async () => {
    const mine = await makeBooking(BOOKING_STATUS.PENDING_PAYMENT, addDays(40), addDays(41));
    const notMine = await makeBooking(BOOKING_STATUS.PENDING_PAYMENT, addDays(40), addDays(41), { ownerId: otherCustomerId });
    await getPrismaClient().hINH_ANH_KHACH_SAN.create({
      data: { MaKhachSan: hotelId, URL: 'https://images.example.test/hotel-cover.jpg', AnhDaiDien: true },
    });
    const res = await request(app).get('/api/bookings').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((b: { MaDatPhong: number }) => b.MaDatPhong);
    expect(ids).toContain(mine.MaDatPhong);
    expect(ids).not.toContain(notMine.MaDatPhong);
    const summary = res.body.data.find((b: { MaDatPhong: number }) => b.MaDatPhong === mine.MaDatPhong);
    expect(summary).toMatchObject({
      DiaChiChiTiet: expect.any(String),
      AnhDaiDien: 'https://images.example.test/hotel-cover.jpg',
    });

    const detail = await request(app).get(`/api/bookings/${mine.MaDatPhong}`).set('Authorization', `Bearer ${customerToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({
      DiaChiChiTiet: expect.any(String),
      AnhDaiDien: 'https://images.example.test/hotel-cover.jpg',
    });
  });

  it('GET /bookings/:id exposes the payment hold only while the booking waits for payment', async () => {
    const pending = await makeBooking(BOOKING_STATUS.PENDING_PAYMENT, addDays(40), addDays(41));
    const confirmed = await makeBooking(BOOKING_STATUS.CONFIRMED, addDays(40), addDays(41));
    const cancelled = await makeBooking(BOOKING_STATUS.CANCELLED, addDays(40), addDays(41));
    const detail = async (id: number) => (await request(app).get(`/api/bookings/${id}`).set('Authorization', `Bearer ${customerToken}`)).body.data;

    const waiting = await detail(pending.MaDatPhong);
    expect(waiting.TrangThai).toBe(BOOKING_STATUS.PENDING_PAYMENT);
    expect(waiting.HanThanhToan).toBe(new Date(new Date(waiting.NgayTao).getTime() + env.PAYMENT_TIMEOUT_MINUTES * 60_000).toISOString());
    expect(waiting.SoGiayConLai).toBeGreaterThanOrEqual(0);
    expect(waiting.SoGiayConLai).toBeLessThanOrEqual(env.PAYMENT_TIMEOUT_MINUTES * 60);

    for (const other of [await detail(confirmed.MaDatPhong), await detail(cancelled.MaDatPhong)]) {
      expect(other.HanThanhToan).toBeNull();
      expect(other.SoGiayConLai).toBeNull();
    }
  });

  it('GET /bookings/:id 403 for a non-owning customer, 200 with full detail for the owner', async () => {
    const booking = await makeBooking(BOOKING_STATUS.PENDING_PAYMENT, addDays(40), addDays(41), { tongTienPhong: 800_000 });

    const forbidden = await request(app).get(`/api/bookings/${booking.MaDatPhong}`).set('Authorization', `Bearer ${otherCustomerToken}`);
    expect(forbidden.status).toBe(403);

    const own = await request(app).get(`/api/bookings/${booking.MaDatPhong}`).set('Authorization', `Bearer ${customerToken}`);
    expect(own.status).toBe(200);
    expect(own.body.data.MaDatPhong).toBe(booking.MaDatPhong);
    expect(own.body.data.TongTienThanhToan).toBe(800_000);
    expect(own.body.data.TenKhachSan).toMatch(/^Test Hotel /);
  });
});

describe('POST /bookings/:id/cancel — ownership & state (HTTP, no payment involved)', () => {
  it('401 when not authenticated', async () => {
    const booking = await makeBooking(BOOKING_STATUS.PENDING_PAYMENT, addDays(10), addDays(12));
    const res = await request(app).post(`/api/bookings/${booking.MaDatPhong}/cancel`);
    expect(res.status).toBe(401);
  });

  it('403 when the role is not Khách hàng', async () => {
    const booking = await makeBooking(BOOKING_STATUS.PENDING_PAYMENT, addDays(10), addDays(12));
    const res = await request(app).post(`/api/bookings/${booking.MaDatPhong}/cancel`).set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(403);
  });

  it('404 for a non-existent booking', async () => {
    const res = await request(app).post('/api/bookings/999999999/cancel').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(404);
  });

  it("403 when cancelling someone else's booking", async () => {
    const booking = await makeBooking(BOOKING_STATUS.PENDING_PAYMENT, addDays(10), addDays(12), { ownerId: otherCustomerId });
    const res = await request(app).post(`/api/bookings/${booking.MaDatPhong}/cancel`).set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('400 when already cancelled', async () => {
    const booking = await makeBooking(BOOKING_STATUS.CANCELLED, addDays(10), addDays(12));
    const res = await request(app).post(`/api/bookings/${booking.MaDatPhong}/cancel`).set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(400);
  });

  it('400 when already completed', async () => {
    const booking = await makeBooking(BOOKING_STATUS.COMPLETED, addDays(10), addDays(12));
    const res = await request(app).post(`/api/bookings/${booking.MaDatPhong}/cancel`).set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(400);
  });

  it('200 cancels a never-paid "Chờ thanh toán" booking — no HOAN_TIEN is ever created for it (never fake a refund for money that was never captured)', async () => {
    const booking = await makeBooking(BOOKING_STATUS.PENDING_PAYMENT, addDays(10), addDays(12));
    const res = await request(app).post(`/api/bookings/${booking.MaDatPhong}/cancel`).set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.TrangThai).toBe(BOOKING_STATUS.CANCELLED);
    expect(res.body.data.ThanhToan).toEqual([]);
  });
});

describe('Cancelling a never-paid booking frees the room it held (M6 §2/§3, end-to-end through the real booking API)', () => {
  it('a cancelled booking no longer blocks a same-slot booking for the last remaining room', async () => {
    const roomType = await createTestRoomType(hotelId);
    const prisma = getPrismaClient();
    const checkIn = addDays(20);
    const checkOut = addDays(21);
    await prisma.qUY_PHONG_GIA.create({
      data: { MaLoaiPhong: roomType.MaLoaiPhong, NgayApDung: checkIn, GiaPhong: 500_000, SoLuongPhong: 1, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE },
    });

    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const createRes = await request(app)
      .post(`/api/hotels/${hotelId}/bookings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ checkIn: iso(checkIn), checkOut: iso(checkOut), rooms: [{ maLoaiPhong: roomType.MaLoaiPhong, soLuong: 1 }] });
    expect(createRes.status).toBe(201);
    const maDatPhong = createRes.body.data.MaDatPhong;

    // Room is sold out now — a second booking for the same slot must fail.
    const blockedRes = await request(app)
      .post(`/api/hotels/${hotelId}/bookings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ checkIn: iso(checkIn), checkOut: iso(checkOut), rooms: [{ maLoaiPhong: roomType.MaLoaiPhong, soLuong: 1 }] });
    expect(blockedRes.status).toBe(409);

    const cancelRes = await request(app).post(`/api/bookings/${maDatPhong}/cancel`).set('Authorization', `Bearer ${customerToken}`);
    expect(cancelRes.status).toBe(200);

    // Room is free again after cancelling.
    const retryRes = await request(app)
      .post(`/api/hotels/${hotelId}/bookings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ checkIn: iso(checkIn), checkOut: iso(checkOut), rooms: [{ maLoaiPhong: roomType.MaLoaiPhong, soLuong: 1 }] });
    expect(retryRes.status).toBe(201);
  });
});

describe('Payment timeout (M6 §2) — an abandoned "Chờ thanh toán" hold is auto-cancelled and stops occupying the room', () => {
  it('a stale pending hold (backdated NgayTao) is freed the next time a booking is attempted for the same slot', async () => {
    const roomType = await createTestRoomType(hotelId);
    const prisma = getPrismaClient();
    const checkIn = addDays(30);
    const checkOut = addDays(31);
    await prisma.qUY_PHONG_GIA.create({
      data: { MaLoaiPhong: roomType.MaLoaiPhong, NgayApDung: checkIn, GiaPhong: 500_000, SoLuongPhong: 1, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE },
    });

    const staleNgayTao = new Date(Date.now() - 60 * 60_000); // 60 minutes ago, well past PAYMENT_TIMEOUT_MINUTES
    const stale = await createTestBookingDirect(customerId, hotelId, tieredPolicyId, checkIn, checkOut, {
      trangThai: BOOKING_STATUS.PENDING_PAYMENT,
      ngayTao: staleNgayTao,
    });
    await prisma.cHI_TIET_DAT_PHONG.create({ data: { MaDatPhong: stale.MaDatPhong, MaLoaiPhong: roomType.MaLoaiPhong, SoLuongPhong: 1 } });

    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const res = await request(app)
      .post(`/api/hotels/${hotelId}/bookings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ checkIn: iso(checkIn), checkOut: iso(checkOut), rooms: [{ maLoaiPhong: roomType.MaLoaiPhong, soLuong: 1 }] });

    expect(res.status).toBe(201); // would be 409 if the stale hold were not swept

    const refreshedStale = await prisma.dAT_PHONG.findUnique({ where: { MaDatPhong: stale.MaDatPhong } });
    expect(refreshedStale!.TrangThai).toBe(BOOKING_STATUS.CANCELLED);
  });

  it('a fresh pending hold (within the timeout) still blocks a same-slot booking — the sweep only touches genuinely stale rows', async () => {
    const roomType = await createTestRoomType(hotelId);
    const prisma = getPrismaClient();
    const checkIn = addDays(31);
    const checkOut = addDays(32);
    await prisma.qUY_PHONG_GIA.create({
      data: { MaLoaiPhong: roomType.MaLoaiPhong, NgayApDung: checkIn, GiaPhong: 500_000, SoLuongPhong: 1, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE },
    });

    const fresh = await createTestBookingDirect(customerId, hotelId, tieredPolicyId, checkIn, checkOut, {
      trangThai: BOOKING_STATUS.PENDING_PAYMENT,
    });
    await prisma.cHI_TIET_DAT_PHONG.create({ data: { MaDatPhong: fresh.MaDatPhong, MaLoaiPhong: roomType.MaLoaiPhong, SoLuongPhong: 1 } });

    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const res = await request(app)
      .post(`/api/hotels/${hotelId}/bookings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ checkIn: iso(checkIn), checkOut: iso(checkOut), rooms: [{ maLoaiPhong: roomType.MaLoaiPhong, soLuong: 1 }] });

    expect(res.status).toBe(409);
  });
});

describe('BookingsService.cancelBooking — refund tier selection & amount (service-level, FakeRefundGateway — no live network)', () => {
  it('>=72h before check-in → 100% refund, HOAN_TIEN created and marked "Thành công"', async () => {
    const fakeGateway = new FakeRefundGateway({ success: true, message: 'ok' });
    const service = new BookingsService(new BookingsRepository(), fakeGateway);

    const booking = await makeBooking(BOOKING_STATUS.CONFIRMED, addDays(5), addDays(6), { tongTienPhong: 1_000_000 });
    const payment = await createTestPayment(booking.MaDatPhong, 1_000_000, PAYMENT_STATUS.SUCCESS, encodeGatewayRef('PAYTEST1', '900001', '20260101000000'));

    const result = await service.cancelBooking(booking.MaDatPhong, customerId, {}, '127.0.0.1');

    expect(result.TrangThai).toBe(BOOKING_STATUS.CANCELLED);
    expect(result.ThanhToan[0].MaThanhToan).toBe(payment.MaThanhToan);
    expect(result.ThanhToan[0].HoanTien).toHaveLength(1);
    expect(result.ThanhToan[0].HoanTien[0].SoTienHoan).toBe(1_000_000);
    expect(result.ThanhToan[0].HoanTien[0].TrangThai).toBe(REFUND_STATUS.SUCCESS);
    expect(fakeGateway.calls).toHaveLength(1);
    expect(fakeGateway.calls[0].originalTransactionNo).toBe('900001');
  });

  it('between 24h and 72h before check-in → 50% refund', async () => {
    const fakeGateway = new FakeRefundGateway({ success: true, message: 'ok' });
    const service = new BookingsService(new BookingsRepository(), fakeGateway);

    const booking = await makeBooking(BOOKING_STATUS.CONFIRMED, addDays(2), addDays(3), { tongTienPhong: 1_000_000 });
    await createTestPayment(booking.MaDatPhong, 1_000_000, PAYMENT_STATUS.SUCCESS, encodeGatewayRef('PAYTEST2', '900002', '20260101000000'));

    const result = await service.cancelBooking(booking.MaDatPhong, customerId, {}, '127.0.0.1');
    expect(result.ThanhToan[0].HoanTien[0].SoTienHoan).toBe(500_000);
  });

  it('<24h before check-in → 0% refund, no HOAN_TIEN row at all (check-in today: always within 24h of now)', async () => {
    const fakeGateway = new FakeRefundGateway({ success: true, message: 'ok' });
    const service = new BookingsService(new BookingsRepository(), fakeGateway);

    const booking = await makeBooking(BOOKING_STATUS.CONFIRMED, addDays(0), addDays(1), { tongTienPhong: 1_000_000 });
    await createTestPayment(booking.MaDatPhong, 1_000_000, PAYMENT_STATUS.SUCCESS, encodeGatewayRef('PAYTEST3', '900003', '20260101000000'));

    const result = await service.cancelBooking(booking.MaDatPhong, customerId, {}, '127.0.0.1');
    expect(result.ThanhToan[0].HoanTien).toEqual([]);
    expect(fakeGateway.calls).toHaveLength(0); // gateway never even called for a 0% refund
  });

  it('the refund amount never exceeds what was actually paid', async () => {
    const fakeGateway = new FakeRefundGateway({ success: true, message: 'ok' });
    const service = new BookingsService(new BookingsRepository(), fakeGateway);

    const booking = await makeBooking(BOOKING_STATUS.CONFIRMED, addDays(5), addDays(6), { tongTienPhong: 333_333 });
    await createTestPayment(booking.MaDatPhong, 333_333, PAYMENT_STATUS.SUCCESS, encodeGatewayRef('PAYTEST4', '900004', '20260101000000'));

    const result = await service.cancelBooking(booking.MaDatPhong, customerId, {}, '127.0.0.1');
    expect(result.ThanhToan[0].HoanTien[0].SoTienHoan).toBeLessThanOrEqual(333_333);
  });

  it('a gateway rejection leaves the refund "Thất bại" — never faked as success', async () => {
    const fakeGateway = new FakeRefundGateway({ success: false, message: 'VNPAY rejected checksum' });
    const service = new BookingsService(new BookingsRepository(), fakeGateway);

    const booking = await makeBooking(BOOKING_STATUS.CONFIRMED, addDays(5), addDays(6), { tongTienPhong: 1_000_000 });
    await createTestPayment(booking.MaDatPhong, 1_000_000, PAYMENT_STATUS.SUCCESS, encodeGatewayRef('PAYTEST5', '900005', '20260101000000'));

    const result = await service.cancelBooking(booking.MaDatPhong, customerId, {}, '127.0.0.1');
    expect(result.ThanhToan[0].HoanTien[0].TrangThai).toBe(REFUND_STATUS.FAILED);
    expect(result.ThanhToan[0].HoanTien[0].NgayHoanTien).toBeNull();
  });
});

describe('PaymentsService.retryRefund — idempotent (M6 §4/§6)', () => {
  it('retries a failed refund and succeeds once the gateway starts accepting it', async () => {
    const failingGateway = new FakeRefundGateway({ success: false, message: 'temporary outage' });
    const bookingsService = new BookingsService(new BookingsRepository(), failingGateway);

    const booking = await makeBooking(BOOKING_STATUS.CONFIRMED, addDays(5), addDays(6), { tongTienPhong: 1_000_000 });
    await createTestPayment(booking.MaDatPhong, 1_000_000, PAYMENT_STATUS.SUCCESS, encodeGatewayRef('PAYTEST6', '900006', '20260101000000'));
    const cancelled = await bookingsService.cancelBooking(booking.MaDatPhong, customerId, {}, '127.0.0.1');
    const refundId = cancelled.ThanhToan[0].HoanTien[0].MaHoanTien;
    expect(cancelled.ThanhToan[0].HoanTien[0].TrangThai).toBe(REFUND_STATUS.FAILED);

    const succeedingGateway = new FakeRefundGateway({ success: true, message: 'now ok' });
    const paymentsService = new PaymentsService(new PaymentsRepository(), succeedingGateway);
    const retried = await paymentsService.retryRefund(refundId, customerId, '127.0.0.1');
    expect(retried.TrangThai).toBe(REFUND_STATUS.SUCCESS);
    expect(succeedingGateway.calls).toHaveLength(1);

    // Retrying again must NOT call the gateway a second time — already "Thành công" is a no-op.
    const retriedAgain = await paymentsService.retryRefund(refundId, customerId, '127.0.0.1');
    expect(retriedAgain.TrangThai).toBe(REFUND_STATUS.SUCCESS);
    expect(succeedingGateway.calls).toHaveLength(1);
  });

  it('serializes simultaneous retries so the gateway is called only once', async () => {
    const failingGateway = new FakeRefundGateway({ success: false, message: 'temporary outage' });
    const bookingsService = new BookingsService(new BookingsRepository(), failingGateway);
    const booking = await makeBooking(BOOKING_STATUS.CONFIRMED, addDays(5), addDays(6), { tongTienPhong: 1_000_000 });
    await createTestPayment(booking.MaDatPhong, 1_000_000, PAYMENT_STATUS.SUCCESS, encodeGatewayRef('PAYTEST8', '900008', '20260101000000'));
    const cancelled = await bookingsService.cancelBooking(booking.MaDatPhong, customerId, {}, '127.0.0.1');
    const refundId = cancelled.ThanhToan[0].HoanTien[0].MaHoanTien;

    const succeedingGateway = new FakeRefundGateway({ success: true, message: 'ok' });
    const paymentsService = new PaymentsService(new PaymentsRepository(), succeedingGateway);
    const results = await Promise.allSettled([
      paymentsService.retryRefund(refundId, customerId, '127.0.0.1'),
      paymentsService.retryRefund(refundId, customerId, '127.0.0.1'),
    ]);

    // One retry does the work; the other either arrives after it (already "Thành công", a no-op) or meets the
    // attempt in flight and is told so (409) — it never reaches the gateway itself.
    const fulfilled = results.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof paymentsService.retryRefund>>> => r.status === 'fulfilled');
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(fulfilled.some((r) => r.value.TrangThai === REFUND_STATUS.SUCCESS)).toBe(true);
    for (const r of results) if (r.status === 'rejected') expect(r.reason).toMatchObject({ statusCode: 409 });
    expect(succeedingGateway.calls).toHaveLength(1);
  });

  it('403 when a different customer tries to retry someone else\'s refund', async () => {
    const failingGateway = new FakeRefundGateway({ success: false, message: 'fail' });
    const bookingsService = new BookingsService(new BookingsRepository(), failingGateway);
    const booking = await makeBooking(BOOKING_STATUS.CONFIRMED, addDays(5), addDays(6), { tongTienPhong: 1_000_000 });
    await createTestPayment(booking.MaDatPhong, 1_000_000, PAYMENT_STATUS.SUCCESS, encodeGatewayRef('PAYTEST7', '900007', '20260101000000'));
    const cancelled = await bookingsService.cancelBooking(booking.MaDatPhong, customerId, {}, '127.0.0.1');
    const refundId = cancelled.ThanhToan[0].HoanTien[0].MaHoanTien;

    const paymentsService = new PaymentsService(new PaymentsRepository(), failingGateway);
    await expect(paymentsService.retryRefund(refundId, otherCustomerId, '127.0.0.1')).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('PaymentsService.handleCallback — a late success after the booking already expired/was cancelled auto-refunds instead of reviving it (M6 §2 edge case)', () => {
  it('confirms are skipped and a 100% refund is created + attempted when the booking is no longer "Chờ thanh toán"', async () => {
    const fakeGateway = new FakeRefundGateway({ success: true, message: 'ok' });
    const paymentsService = new PaymentsService(new PaymentsRepository(), fakeGateway);
    const prisma = getPrismaClient();

    const booking = await makeBooking(BOOKING_STATUS.PENDING_PAYMENT, addDays(5), addDays(6), { tongTienPhong: 700_000 });
    const txnRef = 'LATETXN1';
    await createTestPayment(booking.MaDatPhong, 700_000, PAYMENT_STATUS.PENDING, txnRef);

    // Simulate the booking having expired (swept elsewhere) while this payment was in flight.
    await prisma.dAT_PHONG.update({ where: { MaDatPhong: booking.MaDatPhong }, data: { TrangThai: BOOKING_STATUS.CANCELLED } });

    const params = {
      vnp_TxnRef: txnRef,
      vnp_Amount: String(700_000 * 100),
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: '900099',
      vnp_PayDate: '20260101000000',
    };
    const vnp_SecureHash = signVnpayParams(params, env.VNPAY_HASH_SECRET);

    const outcome = await paymentsService.handleCallback({ ...params, vnp_SecureHash }, '127.0.0.1');

    expect(outcome.rspCode).toBe('00');
    expect(outcome.redirectStatus).toBe('failed'); // the booking was never revived

    const refreshedBooking = await prisma.dAT_PHONG.findUnique({ where: { MaDatPhong: booking.MaDatPhong } });
    expect(refreshedBooking!.TrangThai).toBe(BOOKING_STATUS.CANCELLED); // still cancelled, not reverted to Confirmed

    const refreshedPayment = await prisma.tHANH_TOAN.findFirst({ where: { MaDatPhong: booking.MaDatPhong } });
    expect(refreshedPayment!.TrangThai).toBe(PAYMENT_STATUS.SUCCESS); // VNPAY really did report success

    const refund = await prisma.hOAN_TIEN.findFirst({ where: { MaThanhToan: refreshedPayment!.MaThanhToan } });
    expect(refund).not.toBeNull();
    expect(Number(refund!.SoTienHoan)).toBe(700_000); // auto-refunded 100%, never kept
    expect(refund!.TrangThai).toBe(REFUND_STATUS.SUCCESS);
    expect(fakeGateway.calls).toHaveLength(1);
  });
});
