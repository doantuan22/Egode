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
import { getPrismaClient } from '../../config/prisma';
import { ROLE_NAMES } from '../../common/constants/roles';
import { BOOKING_STATUS } from '../../common/constants/hotel-status';
import { PAYMENT_STATUS } from '../../common/constants/payment';
import { signVnpayParams, toVnpayDate } from './vnpay';
import { env } from '../../config/env';

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
let customerToken: string;
let otherCustomerId: number;
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

const makeBooking = (trangThai: string, opts: { tongTienPhong?: number; ownerId?: number } = {}) =>
  createTestBookingDirect(opts.ownerId ?? customerId, hotelId, policyId, addDays(10), addDays(12), {
    trangThai,
    tongTienPhong: opts.tongTienPhong ?? 1_000_000,
  });

describe('POST /bookings/:id/payments/vnpay', () => {
  it('401 when not authenticated', async () => {
    const booking = await makeBooking(BOOKING_STATUS.PENDING_PAYMENT);
    const res = await request(app).post(`/api/bookings/${booking.MaDatPhong}/payments/vnpay`);
    expect(res.status).toBe(401);
  });

  it('403 when the account role is not Khách hàng', async () => {
    const booking = await makeBooking(BOOKING_STATUS.PENDING_PAYMENT);
    const res = await request(app)
      .post(`/api/bookings/${booking.MaDatPhong}/payments/vnpay`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(403);
  });

  it("403 when the booking belongs to a different customer (can't pay someone else's booking)", async () => {
    const booking = await makeBooking(BOOKING_STATUS.PENDING_PAYMENT, { ownerId: otherCustomerId });
    const res = await request(app)
      .post(`/api/bookings/${booking.MaDatPhong}/payments/vnpay`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('404 for a non-existent booking', async () => {
    const res = await request(app).post('/api/bookings/999999999/payments/vnpay').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(404);
  });

  it('400 when the booking is not "Chờ thanh toán" (already confirmed)', async () => {
    const booking = await makeBooking(BOOKING_STATUS.CONFIRMED);
    const res = await request(app)
      .post(`/api/bookings/${booking.MaDatPhong}/payments/vnpay`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(400);
  });

  it('400 when the booking was already cancelled', async () => {
    const booking = await makeBooking(BOOKING_STATUS.CANCELLED);
    const res = await request(app)
      .post(`/api/bookings/${booking.MaDatPhong}/payments/vnpay`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(400);
  });

  it('201 creates a "Chờ xử lý" THANH_TOAN and returns a paymentUrl — amount always comes from DAT_PHONG, a spoofed body amount is ignored entirely', async () => {
    const booking = await makeBooking(BOOKING_STATUS.PENDING_PAYMENT, { tongTienPhong: 750_000 });
    const res = await request(app)
      .post(`/api/bookings/${booking.MaDatPhong}/payments/vnpay`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ amount: 1, SoTien: 1 }); // spoofed — must be ignored

    expect(res.status).toBe(201);
    expect(res.body.data.paymentUrl).toContain(env.VNPAY_PAYMENT_URL);
    expect(res.body.data.paymentUrl).toContain(`vnp_Amount=${750_000 * 100}`);

    const prisma = getPrismaClient();
    const payment = await prisma.tHANH_TOAN.findUnique({ where: { MaThanhToan: res.body.data.maThanhToan } });
    expect(Number(payment!.SoTien)).toBe(750_000); // never 1
    expect(payment!.TrangThai).toBe(PAYMENT_STATUS.PENDING);
  });

  it('400 when a successful payment already exists for the booking (defensive re-check)', async () => {
    const booking = await makeBooking(BOOKING_STATUS.PENDING_PAYMENT);
    await createTestPayment(booking.MaDatPhong, 1_000_000, PAYMENT_STATUS.SUCCESS);
    const res = await request(app)
      .post(`/api/bookings/${booking.MaDatPhong}/payments/vnpay`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(400);
  });
});

describe('POST /bookings/:id/payments/vnpay — at most one pending attempt per booking (Bug #4)', () => {
  const createPayment = (bookingId: number) =>
    request(app).post(`/api/bookings/${bookingId}/payments/vnpay`).set('Authorization', `Bearer ${customerToken}`);

  const countByStatus = async (bookingId: number, trangThai: string) =>
    getPrismaClient().tHANH_TOAN.count({ where: { MaDatPhong: bookingId, TrangThai: trangThai } });

  it('two near-simultaneous requests share one pending payment', async () => {
    const booking = await makeBooking(BOOKING_STATUS.PENDING_PAYMENT, { tongTienPhong: 500_000 });
    const [a, b] = await Promise.all([createPayment(booking.MaDatPhong), createPayment(booking.MaDatPhong)]);

    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.body.data.maThanhToan).toBe(b.body.data.maThanhToan);
    expect(a.body.data.maGiaoDichDoiTac).toBe(b.body.data.maGiaoDichDoiTac);
    expect(await countByStatus(booking.MaDatPhong, PAYMENT_STATUS.PENDING)).toBe(1);
    expect(await getPrismaClient().tHANH_TOAN.count({ where: { MaDatPhong: booking.MaDatPhong } })).toBe(1);
  });

  it('a double-click burst (5 parallel requests) still leaves exactly one pending payment', async () => {
    const booking = await makeBooking(BOOKING_STATUS.PENDING_PAYMENT, { tongTienPhong: 520_000 });
    const results = await Promise.all(Array.from({ length: 5 }, () => createPayment(booking.MaDatPhong)));

    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(new Set(results.map((r) => r.body.data.maThanhToan)).size).toBe(1);
    expect(await countByStatus(booking.MaDatPhong, PAYMENT_STATUS.PENDING)).toBe(1);
  });

  it('reuses the existing pending payment instead of inserting another (same txnRef and amount in the URL)', async () => {
    const booking = await makeBooking(BOOKING_STATUS.PENDING_PAYMENT, { tongTienPhong: 530_000 });
    const first = await createPayment(booking.MaDatPhong);
    const second = await createPayment(booking.MaDatPhong);

    expect(second.status).toBe(201);
    expect(second.body.data.maThanhToan).toBe(first.body.data.maThanhToan);
    const url = new URL(second.body.data.paymentUrl);
    expect(url.searchParams.get('vnp_TxnRef')).toBe(first.body.data.maGiaoDichDoiTac);
    expect(url.searchParams.get('vnp_Amount')).toBe(String(530_000 * 100));
    expect(await countByStatus(booking.MaDatPhong, PAYMENT_STATUS.PENDING)).toBe(1);
  });

  it('allows a fresh attempt after the previous payment failed', async () => {
    const booking = await makeBooking(BOOKING_STATUS.PENDING_PAYMENT, { tongTienPhong: 540_000 });
    const failed = await createTestPayment(booking.MaDatPhong, 540_000, PAYMENT_STATUS.FAILED);

    const res = await createPayment(booking.MaDatPhong);
    expect(res.status).toBe(201);
    expect(res.body.data.maThanhToan).not.toBe(failed.MaThanhToan);
    expect(await countByStatus(booking.MaDatPhong, PAYMENT_STATUS.PENDING)).toBe(1);
    expect(await countByStatus(booking.MaDatPhong, PAYMENT_STATUS.FAILED)).toBe(1);
  });

  it('creates no payment at all for a booking that is already confirmed', async () => {
    const booking = await makeBooking(BOOKING_STATUS.CONFIRMED);
    const res = await createPayment(booking.MaDatPhong);

    expect(res.status).toBe(400);
    expect(await getPrismaClient().tHANH_TOAN.count({ where: { MaDatPhong: booking.MaDatPhong } })).toBe(0);
  });

  it('the same pending payment confirmed twice via IPN stays a single successful payment with no pending left', async () => {
    const booking = await makeBooking(BOOKING_STATUS.PENDING_PAYMENT, { tongTienPhong: 550_000 });
    const [a, b] = await Promise.all([createPayment(booking.MaDatPhong), createPayment(booking.MaDatPhong)]);
    const txnRef = a.body.data.maGiaoDichDoiTac as string;
    expect(b.body.data.maGiaoDichDoiTac).toBe(txnRef);

    const base = {
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TransactionNo: '14000099',
      vnp_PayDate: toVnpayDate(new Date()),
      vnp_BankCode: 'NCB',
      vnp_TxnRef: txnRef,
      vnp_Amount: String(550_000 * 100),
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
    };
    const query = { ...base, vnp_SecureHash: signVnpayParams(base, env.VNPAY_HASH_SECRET) };

    const first = await request(app).get('/api/payments/vnpay-ipn').query(query);
    const second = await request(app).get('/api/payments/vnpay-ipn').query(query);
    expect(first.body.RspCode).toBe('00');
    expect(second.body.RspCode).toBe('02');

    expect(await countByStatus(booking.MaDatPhong, PAYMENT_STATUS.PENDING)).toBe(0);
    expect(await countByStatus(booking.MaDatPhong, PAYMENT_STATUS.SUCCESS)).toBe(1);
    expect(await getPrismaClient().hOAN_TIEN.count({ where: { THANH_TOAN: { MaDatPhong: booking.MaDatPhong } } })).toBe(0);
  });
});

describe('GET /bookings/:id/payments/status', () => {
  it('403 for a non-owning customer', async () => {
    const booking = await makeBooking(BOOKING_STATUS.PENDING_PAYMENT, { ownerId: otherCustomerId });
    const res = await request(app)
      .get(`/api/bookings/${booking.MaDatPhong}/payments/status`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('200 lists THANH_TOAN with nested HOAN_TIEN for the owner', async () => {
    const booking = await makeBooking(BOOKING_STATUS.CONFIRMED, { tongTienPhong: 500_000 });
    await createTestPayment(booking.MaDatPhong, 500_000, PAYMENT_STATUS.SUCCESS);
    const res = await request(app)
      .get(`/api/bookings/${booking.MaDatPhong}/payments/status`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.ThanhToan).toHaveLength(1);
    expect(res.body.data.ThanhToan[0].SoTien).toBe(500_000);
    expect(res.body.data.ThanhToan[0].HoanTien).toEqual([]);
  });
});

describe('GET /payments/vnpay-ipn', () => {
  const createPendingPaymentViaApi = async (tongTienPhong: number) => {
    const booking = await makeBooking(BOOKING_STATUS.PENDING_PAYMENT, { tongTienPhong });
    const createRes = await request(app)
      .post(`/api/bookings/${booking.MaDatPhong}/payments/vnpay`)
      .set('Authorization', `Bearer ${customerToken}`);
    const url = new URL(createRes.body.data.paymentUrl);
    const txnRef = url.searchParams.get('vnp_TxnRef')!;
    return { booking, txnRef };
  };

  const signedIpnQuery = (overrides: Record<string, string>) => {
    const base = {
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TransactionNo: '14000001',
      vnp_PayDate: toVnpayDate(new Date()),
      vnp_BankCode: 'NCB',
      ...overrides,
    };
    const hash = signVnpayParams(base, env.VNPAY_HASH_SECRET);
    return { ...base, vnp_SecureHash: hash };
  };

  it('00 + confirms the booking on a genuine success callback', async () => {
    const { booking, txnRef } = await createPendingPaymentViaApi(600_000);
    const query = signedIpnQuery({
      vnp_TxnRef: txnRef,
      vnp_Amount: String(600_000 * 100),
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
    });

    const res = await request(app).get('/api/payments/vnpay-ipn').query(query);
    expect(res.body).toEqual({ RspCode: '00', Message: 'Confirm Success' });

    const prisma = getPrismaClient();
    const refreshed = await prisma.dAT_PHONG.findUnique({ where: { MaDatPhong: booking.MaDatPhong } });
    expect(refreshed!.TrangThai).toBe(BOOKING_STATUS.CONFIRMED);
    const payment = await prisma.tHANH_TOAN.findFirst({ where: { MaDatPhong: booking.MaDatPhong } });
    expect(payment!.TrangThai).toBe(PAYMENT_STATUS.SUCCESS);
  });

  it('repeating the exact same IPN does not double-confirm or duplicate anything (idempotent)', async () => {
    const { booking, txnRef } = await createPendingPaymentViaApi(400_000);
    const query = signedIpnQuery({
      vnp_TxnRef: txnRef,
      vnp_Amount: String(400_000 * 100),
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
    });

    const first = await request(app).get('/api/payments/vnpay-ipn').query(query);
    expect(first.body.RspCode).toBe('00');

    const second = await request(app).get('/api/payments/vnpay-ipn').query(query);
    expect(second.body).toEqual({ RspCode: '02', Message: 'Order already confirmed' });

    const prisma = getPrismaClient();
    const payments = await prisma.tHANH_TOAN.findMany({ where: { MaDatPhong: booking.MaDatPhong } });
    expect(payments).toHaveLength(1); // no duplicate THANH_TOAN row
    expect(payments[0].TrangThai).toBe(PAYMENT_STATUS.SUCCESS);
    const refreshed = await prisma.dAT_PHONG.findUnique({ where: { MaDatPhong: booking.MaDatPhong } });
    expect(refreshed!.TrangThai).toBe(BOOKING_STATUS.CONFIRMED); // still confirmed exactly once
  });

  it('serializes simultaneous duplicate IPNs without creating an erroneous refund', async () => {
    const { booking, txnRef } = await createPendingPaymentViaApi(410_000);
    const query = signedIpnQuery({
      vnp_TxnRef: txnRef,
      vnp_Amount: String(410_000 * 100),
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
    });

    const [first, second] = await Promise.all([
      request(app).get('/api/payments/vnpay-ipn').query(query),
      request(app).get('/api/payments/vnpay-ipn').query(query),
    ]);
    expect([first.body.RspCode, second.body.RspCode].sort()).toEqual(['00', '02']);

    const prisma = getPrismaClient();
    const payment = await prisma.tHANH_TOAN.findFirstOrThrow({ where: { MaDatPhong: booking.MaDatPhong } });
    expect(await prisma.hOAN_TIEN.count({ where: { MaThanhToan: payment.MaThanhToan } })).toBe(0);
    expect((await prisma.dAT_PHONG.findUniqueOrThrow({ where: { MaDatPhong: booking.MaDatPhong } })).TrangThai).toBe(BOOKING_STATUS.CONFIRMED);
  });

  it('97 on an invalid/tampered signature — nothing is mutated', async () => {
    const { booking, txnRef } = await createPendingPaymentViaApi(300_000);
    const query = signedIpnQuery({ vnp_TxnRef: txnRef, vnp_Amount: String(300_000 * 100), vnp_ResponseCode: '00', vnp_TransactionStatus: '00' });
    const tampered = { ...query, vnp_Amount: String(1 * 100) }; // changed after signing

    const res = await request(app).get('/api/payments/vnpay-ipn').query(tampered);
    expect(res.body.RspCode).toBe('97');

    const prisma = getPrismaClient();
    const payment = await prisma.tHANH_TOAN.findFirst({ where: { MaDatPhong: booking.MaDatPhong } });
    expect(payment!.TrangThai).toBe(PAYMENT_STATUS.PENDING);
  });

  it('04 on an amount mismatch — payment left pending, not finalized', async () => {
    const { booking, txnRef } = await createPendingPaymentViaApi(200_000);
    const query = signedIpnQuery({
      vnp_TxnRef: txnRef,
      vnp_Amount: String(999_999 * 100), // does not match the 200_000 stored on THANH_TOAN
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
    });

    const res = await request(app).get('/api/payments/vnpay-ipn').query(query);
    expect(res.body.RspCode).toBe('04');

    const prisma = getPrismaClient();
    const payment = await prisma.tHANH_TOAN.findFirst({ where: { MaDatPhong: booking.MaDatPhong } });
    expect(payment!.TrangThai).toBe(PAYMENT_STATUS.PENDING);
  });

  it('01 for an unknown vnp_TxnRef', async () => {
    const query = signedIpnQuery({ vnp_TxnRef: 'NO_SUCH_TXN_REF', vnp_Amount: '10000', vnp_ResponseCode: '00', vnp_TransactionStatus: '00' });
    const res = await request(app).get('/api/payments/vnpay-ipn').query(query);
    expect(res.body.RspCode).toBe('01');
  });

  it('a failed transaction (vnp_ResponseCode <> 00) marks the payment "Thất bại" and never confirms the booking', async () => {
    const { booking, txnRef } = await createPendingPaymentViaApi(450_000);
    const query = signedIpnQuery({
      vnp_TxnRef: txnRef,
      vnp_Amount: String(450_000 * 100),
      vnp_ResponseCode: '24', // customer cancelled at VNPAY
      vnp_TransactionStatus: '02',
    });

    const res = await request(app).get('/api/payments/vnpay-ipn').query(query);
    expect(res.body).toEqual({ RspCode: '00', Message: 'Confirm Success' }); // VNPAY still gets acked

    const prisma = getPrismaClient();
    const payment = await prisma.tHANH_TOAN.findFirst({ where: { MaDatPhong: booking.MaDatPhong } });
    expect(payment!.TrangThai).toBe(PAYMENT_STATUS.FAILED);
    const refreshed = await prisma.dAT_PHONG.findUnique({ where: { MaDatPhong: booking.MaDatPhong } });
    expect(refreshed!.TrangThai).toBe(BOOKING_STATUS.PENDING_PAYMENT); // never confirmed
  });
});

describe('GET /payments/vnpay-return', () => {
  it('redirects to FRONTEND_URL/payment/result with the outcome', async () => {
    const booking = await makeBooking(BOOKING_STATUS.PENDING_PAYMENT);
    const createRes = await request(app)
      .post(`/api/bookings/${booking.MaDatPhong}/payments/vnpay`)
      .set('Authorization', `Bearer ${customerToken}`);
    const url = new URL(createRes.body.data.paymentUrl);
    const txnRef = url.searchParams.get('vnp_TxnRef')!;

    const params = { vnp_TxnRef: txnRef, vnp_Amount: String(1_000_000 * 100), vnp_ResponseCode: '00', vnp_TransactionStatus: '00' };
    const hash = signVnpayParams(params, env.VNPAY_HASH_SECRET);

    const res = await request(app).get('/api/payments/vnpay-return').query({ ...params, vnp_SecureHash: hash });
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/payment/result');
    expect(res.headers.location).toContain('status=success');
    expect(res.headers.location).toContain(`bookingId=${booking.MaDatPhong}`);
  });
});
