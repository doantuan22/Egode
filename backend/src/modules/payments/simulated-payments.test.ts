import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { env } from '../../config/env';
import { getPrismaClient } from '../../config/prisma';
import { ROLE_NAMES } from '../../common/constants/roles';
import { addDaysToDateKey, businessToday } from '../../common/utils/stay-dates';
import {
  createTestAccount,
  createTestBookingDirect,
  createTestCancellationPolicy,
  createTestDiaPhuong,
  createTestHotel,
  createTestPayment,
  deleteTestAccount,
  deleteTestCancellationPolicy,
  deleteTestDiaPhuong,
  deleteTestHotel,
} from '../../test/factories';
import { decodeGatewayRef } from './vnpay';
import { getPaymentProvider } from './payment-provider';

/**
 * Simulated payments and refunds (PAYMENT_PROVIDER=simulated): nothing leaves the process, yet the same rows are
 * written as with the real gateway — THANH_TOAN "Thành công" + booking "Đã xác nhận", and on cancel a HOAN_TIEN that
 * runs through the normal three-step lifecycle and ends "Thành công" with NgayHoanTien.
 */
const prisma = () => getPrismaClient();
const day = (n: number) => new Date(`${addDaysToDateKey(businessToday(), n)}T00:00:00Z`);

const accountIds: number[] = [];
let cityId = 0;
let hotelId = 0;
let policyId = 0;
let strictPolicyId = 0;
const bookingIds: number[] = [];
const extraPolicyIds: number[] = [];

const originalProvider = env.PAYMENT_PROVIDER;
afterEach(() => {
  env.PAYMENT_PROVIDER = originalProvider;
  vi.restoreAllMocks();
});

const login = async (email: string, password: string) =>
  (await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password })).body.data.accessToken as string;

const customer = async () => {
  const made = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(made.account.MaTaiKhoan);
  return { id: made.account.MaTaiKhoan, token: await login(made.account.Email, made.plainPassword) };
};

const pendingBooking = async (customerId: number, total = 900_000, checkInOffset = 30) => {
  const booking = await createTestBookingDirect(customerId, hotelId, policyId, day(checkInOffset), day(checkInOffset + 1), { tongTienPhong: total });
  bookingIds.push(booking.MaDatPhong);
  return booking;
};

const pay = (bookingId: number, token: string) => request(app).post(`/api/bookings/${bookingId}/payments/simulate`).set('Authorization', `Bearer ${token}`);
const cancel = (bookingId: number, token: string) => request(app).post(`/api/bookings/${bookingId}/cancel`).set('Authorization', `Bearer ${token}`).send({});

beforeAll(async () => {
  const owner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  accountIds.push(owner.account.MaTaiKhoan);
  cityId = (await createTestDiaPhuong()).MaDiaPhuong;
  hotelId = (await createTestHotel(owner.account.MaTaiKhoan, cityId)).MaKhachSan;
  policyId = (await createTestCancellationPolicy([{ soGioTruocNhanPhong: 24, tyLeHoanTien: 100 }])).MaChinhSachHuy;
  strictPolicyId = (await createTestCancellationPolicy([{ soGioTruocNhanPhong: 100000, tyLeHoanTien: 100 }])).MaChinhSachHuy; // 0 % in practice
});

afterAll(async () => {
  const db = prisma();
  await db.hOAN_TIEN.deleteMany({ where: { THANH_TOAN: { MaDatPhong: { in: bookingIds } } } });
  await db.tHANH_TOAN.deleteMany({ where: { MaDatPhong: { in: bookingIds } } });
  await db.dAT_PHONG.deleteMany({ where: { MaDatPhong: { in: bookingIds } } });
  await deleteTestHotel(hotelId);
  await deleteTestCancellationPolicy(policyId);
  await deleteTestCancellationPolicy(strictPolicyId);
  for (const id of extraPolicyIds) await deleteTestCancellationPolicy(id);
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await deleteTestDiaPhuong(cityId);
});

describe('GET /api/payments/config', () => {
  it('says which payment mode is active (public)', async () => {
    env.PAYMENT_PROVIDER = 'simulated';
    expect((await request(app).get('/api/payments/config')).body.data).toEqual({ provider: 'simulated' });
    env.PAYMENT_PROVIDER = 'vnpay';
    expect((await request(app).get('/api/payments/config')).body.data).toEqual({ provider: 'vnpay' });
  });

  it('defaults to simulated when nothing is configured', () => {
    env.PAYMENT_PROVIDER = undefined;
    expect(getPaymentProvider()).toBe('simulated');
  });
});

describe('POST /api/bookings/:id/payments/simulate', () => {
  it('pays and confirms in one call, writing the same rows a real payment would, with no network call', async () => {
    env.PAYMENT_PROVIDER = 'simulated';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const who = await customer();
    const booking = await pendingBooking(who.id, 900_000);

    const res = await pay(booking.MaDatPhong, who.token);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ maDatPhong: booking.MaDatPhong, soTien: 900_000, trangThaiThanhToan: 'Thành công', trangThaiDatPhong: 'Đã xác nhận' });
    expect(fetchSpy).not.toHaveBeenCalled();

    const row = await prisma().dAT_PHONG.findUniqueOrThrow({ where: { MaDatPhong: booking.MaDatPhong }, include: { THANH_TOAN: true } });
    expect(row.TrangThai).toBe('Đã xác nhận');
    expect(row.THANH_TOAN).toHaveLength(1);
    const payment = row.THANH_TOAN[0];
    expect(payment).toMatchObject({ TrangThai: 'Thành công', PhuongThucThanhToan: 'VNPAY (mô phỏng)' });
    expect(Number(payment.SoTien)).toBe(900_000);
    expect(Number(payment.SoTien)).toBe(Number(row.TongTienThanhToan));
    // transaction number + pay date are stored like a real confirmation, so a refund can find them
    const ref = decodeGatewayRef(payment.MaGiaoDichDoiTac);
    expect(ref.transactionNo).toMatch(/^\d{8}$/);
    expect(ref.payDate).toMatch(/^\d{14}$/);
    expect(payment.MaGiaoDichDoiTac.startsWith(res.body.data.maGiaoDichDoiTac)).toBe(true);
  });

  it('the status endpoint and the payment-result logic see it as a normal successful payment', async () => {
    env.PAYMENT_PROVIDER = 'simulated';
    const who = await customer();
    const booking = await pendingBooking(who.id, 500_000);
    await pay(booking.MaDatPhong, who.token);

    const status = await request(app).get(`/api/bookings/${booking.MaDatPhong}/payments/status`).set('Authorization', `Bearer ${who.token}`);

    expect(status.status).toBe(200);
    expect(status.body.data).toMatchObject({ TrangThaiDatPhong: 'Đã xác nhận' });
    expect(status.body.data.ThanhToan).toHaveLength(1);
    expect(status.body.data.ThanhToan[0]).toMatchObject({ SoTien: 500_000, TrangThai: 'Thành công' });
  });

  it('the amount comes from the booking, never from the request', async () => {
    env.PAYMENT_PROVIDER = 'simulated';
    const who = await customer();
    const booking = await pendingBooking(who.id, 777_000);
    const res = await pay(booking.MaDatPhong, who.token).send({ amount: 1, soTien: 1 });
    expect(res.status).toBe(201);
    expect(res.body.data.soTien).toBe(777_000);
  });

  it('a second click finds the booking already confirmed: refused, and there is still exactly one payment', async () => {
    env.PAYMENT_PROVIDER = 'simulated';
    const who = await customer();
    const booking = await pendingBooking(who.id);

    expect((await pay(booking.MaDatPhong, who.token)).status).toBe(201);
    const again = await pay(booking.MaDatPhong, who.token);

    expect(again.status).toBe(400);
    expect(await prisma().tHANH_TOAN.count({ where: { MaDatPhong: booking.MaDatPhong } })).toBe(1);
  });

  it('five parallel clicks: exactly one succeeds, one payment row exists, the booking is confirmed once', async () => {
    env.PAYMENT_PROVIDER = 'simulated';
    const who = await customer();
    const booking = await pendingBooking(who.id);

    const results = await Promise.all(Array.from({ length: 5 }, () => pay(booking.MaDatPhong, who.token)));

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status !== 201).every((r) => r.status === 400 || r.status === 409)).toBe(true);
    expect(await prisma().tHANH_TOAN.count({ where: { MaDatPhong: booking.MaDatPhong, TrangThai: 'Thành công' } })).toBe(1);
    expect((await prisma().dAT_PHONG.findUniqueOrThrow({ where: { MaDatPhong: booking.MaDatPhong } })).TrangThai).toBe('Đã xác nhận');
  });

  it('only the booking owner can pay it; nothing is written for anyone else', async () => {
    env.PAYMENT_PROVIDER = 'simulated';
    const owner = await customer();
    const stranger = await customer();
    const booking = await pendingBooking(owner.id);

    const res = await pay(booking.MaDatPhong, stranger.token);

    expect(res.status).toBe(403);
    expect(await prisma().tHANH_TOAN.count({ where: { MaDatPhong: booking.MaDatPhong } })).toBe(0);
    expect((await prisma().dAT_PHONG.findUniqueOrThrow({ where: { MaDatPhong: booking.MaDatPhong } })).TrangThai).toBe('Chờ thanh toán');
  });

  it('needs a signed-in customer', async () => {
    env.PAYMENT_PROVIDER = 'simulated';
    const who = await customer();
    const booking = await pendingBooking(who.id);
    expect((await request(app).post(`/api/bookings/${booking.MaDatPhong}/payments/simulate`)).status).toBe(401);
  });

  it('refuses a cancelled booking, an unknown booking and a 0 đ booking, writing nothing', async () => {
    env.PAYMENT_PROVIDER = 'simulated';
    const who = await customer();
    const cancelled = await createTestBookingDirect(who.id, hotelId, policyId, day(30), day(31), { trangThai: 'Đã hủy' });
    const free = await createTestBookingDirect(who.id, hotelId, policyId, day(40), day(41), { tongTienPhong: 100_000, soTienGiam: 100_000 });
    bookingIds.push(cancelled.MaDatPhong, free.MaDatPhong);

    expect((await pay(cancelled.MaDatPhong, who.token)).status).toBe(400);
    expect((await pay(free.MaDatPhong, who.token)).status).toBe(400);
    expect((await pay(999_999_999, who.token)).status).toBe(404);
    expect(await prisma().tHANH_TOAN.count({ where: { MaDatPhong: { in: [cancelled.MaDatPhong, free.MaDatPhong] } } })).toBe(0);
  });

  it('a hold that ran out (older than the payment window) cannot be paid any more', async () => {
    env.PAYMENT_PROVIDER = 'simulated';
    const who = await customer();
    const booking = await createTestBookingDirect(who.id, hotelId, policyId, day(30), day(31), { ngayTao: new Date(Date.now() - 20 * 60_000) });
    bookingIds.push(booking.MaDatPhong);

    const res = await pay(booking.MaDatPhong, who.token);

    expect(res.status).toBe(400);
    expect((await prisma().dAT_PHONG.findUniqueOrThrow({ where: { MaDatPhong: booking.MaDatPhong } })).TrangThai).toBe('Đã hủy');
    expect(await prisma().tHANH_TOAN.count({ where: { MaDatPhong: booking.MaDatPhong } })).toBe(0);
  });

  it('is switched off when the real gateway mode is configured', async () => {
    env.PAYMENT_PROVIDER = 'vnpay';
    const who = await customer();
    const booking = await pendingBooking(who.id);

    const res = await pay(booking.MaDatPhong, who.token);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/mô phỏng/);
    expect(await prisma().tHANH_TOAN.count({ where: { MaDatPhong: booking.MaDatPhong } })).toBe(0);
  });
});

describe('simulated refund on cancel', () => {
  const paidBooking = async (customerId: number, total: number, policy = policyId, offset = 30) => {
    const booking = await createTestBookingDirect(customerId, hotelId, policy, day(offset), day(offset + 1), { trangThai: 'Đã xác nhận', tongTienPhong: total });
    bookingIds.push(booking.MaDatPhong);
    // a payment WITHOUT a VNPAY transaction number (like seed / older rows): the simulated refund must not need one
    const payment = await createTestPayment(booking.MaDatPhong, total, 'Thành công', `NOTXN${booking.MaDatPhong}`);
    return { booking, payment };
  };

  it('cancelling a paid booking refunds it per the policy: HOAN_TIEN "Thành công" with NgayHoanTien, no network call', async () => {
    env.PAYMENT_PROVIDER = 'simulated';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const who = await customer();
    const { booking, payment } = await paidBooking(who.id, 1_000_000);

    const res = await cancel(booking.MaDatPhong, who.token);

    expect(res.status).toBe(200);
    expect(res.body.data.TrangThai).toBe('Đã hủy');
    expect(fetchSpy).not.toHaveBeenCalled();
    const refunds = await prisma().hOAN_TIEN.findMany({ where: { MaThanhToan: payment.MaThanhToan } });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ TrangThai: 'Thành công' });
    expect(Number(refunds[0].SoTienHoan)).toBe(1_000_000);
    expect(refunds[0].NgayHoanTien).not.toBeNull();
    expect(refunds[0].NgayHoanTien!.getTime()).toBeGreaterThanOrEqual(refunds[0].NgayYeuCau.getTime());
    // the booking detail the client reads back carries the refund
    const refund = res.body.data.ThanhToan[0].HoanTien;
    expect(refund).toHaveLength(1);
    expect(refund[0]).toMatchObject({ TrangThai: 'Thành công', SoTienHoan: 1_000_000 });
  });

  it('a pay-then-cancel round trip entirely inside the simulation ends with money returned once', async () => {
    env.PAYMENT_PROVIDER = 'simulated';
    const who = await customer();
    const booking = await pendingBooking(who.id, 640_000);
    expect((await pay(booking.MaDatPhong, who.token)).status).toBe(201);

    const res = await cancel(booking.MaDatPhong, who.token);

    expect(res.status).toBe(200);
    const payment = await prisma().tHANH_TOAN.findFirstOrThrow({ where: { MaDatPhong: booking.MaDatPhong }, include: { HOAN_TIEN: true } });
    expect(payment.HOAN_TIEN).toHaveLength(1);
    expect(payment.HOAN_TIEN[0].TrangThai).toBe('Thành công');
    expect(Number(payment.HOAN_TIEN[0].SoTienHoan)).toBe(640_000);
    // cancelling again changes nothing
    expect((await cancel(booking.MaDatPhong, who.token)).status).toBe(400);
    expect(await prisma().hOAN_TIEN.count({ where: { MaThanhToan: payment.MaThanhToan } })).toBe(1);
  });

  it('a tier below 100 % refunds exactly that share (rounded to the đồng, never above what was paid)', async () => {
    env.PAYMENT_PROVIDER = 'simulated';
    const half = await createTestCancellationPolicy([{ soGioTruocNhanPhong: 24, tyLeHoanTien: 50 }]);
    extraPolicyIds.push(half.MaChinhSachHuy);
    const who = await customer();
    const { booking, payment } = await paidBooking(who.id, 1_000_001, half.MaChinhSachHuy);

    await cancel(booking.MaDatPhong, who.token);

    const refund = await prisma().hOAN_TIEN.findFirstOrThrow({ where: { MaThanhToan: payment.MaThanhToan } });
    expect(Number(refund.SoTienHoan)).toBe(500_001);
    expect(refund.TrangThai).toBe('Thành công');
  });

  it('outside every refund window (0 %): the booking is cancelled and NO refund row is created', async () => {
    env.PAYMENT_PROVIDER = 'simulated';
    const who = await customer();
    const { booking, payment } = await paidBooking(who.id, 800_000, strictPolicyId);

    const res = await cancel(booking.MaDatPhong, who.token);

    expect(res.status).toBe(200);
    expect(res.body.data.TrangThai).toBe('Đã hủy');
    expect(await prisma().hOAN_TIEN.count({ where: { MaThanhToan: payment.MaThanhToan } })).toBe(0);
  });

  it('cancelling an unpaid booking needs no refund at all', async () => {
    env.PAYMENT_PROVIDER = 'simulated';
    const who = await customer();
    const booking = await pendingBooking(who.id);
    const res = await cancel(booking.MaDatPhong, who.token);
    expect(res.status).toBe(200);
    expect(await prisma().hOAN_TIEN.count({ where: { THANH_TOAN: { MaDatPhong: booking.MaDatPhong } } })).toBe(0);
  });
});
