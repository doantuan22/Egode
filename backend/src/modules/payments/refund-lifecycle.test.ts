import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
import { Prisma } from '../../generated/prisma/client';
import { env } from '../../config/env';
import { ROLE_NAMES } from '../../common/constants/roles';
import { BOOKING_STATUS } from '../../common/constants/hotel-status';
import { PAYMENT_STATUS, REFUND_STATUS } from '../../common/constants/payment';
import { BookingsService } from '../bookings/bookings.service';
import { PaymentsService } from './payments.service';
import { encodeGatewayRef, signVnpayParams } from './vnpay';
import type { RefundGateway, RefundRequestInput, RefundResult } from './refund-gateway';

/**
 * Bug #8 — the refund simulation is never called while a database transaction is open, and HOAN_TIEN keeps
 * ONE row per refund through its whole life (Chờ xử lý → Thành công / Thất bại), however often it is retried.
 * Everything runs against the real SQL Server test database.
 */
const addDays = (days: number): Date => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

const IP = '127.0.0.1';
let refSeq = 0;
const packedRef = () => encodeGatewayRef(`LIFE${Date.now()}${++refSeq}`, `${900000 + refSeq}`, '20260101000000');

/** What the database looked like, from a DIFFERENT connection, at the moment the gateway was called. */
interface Probe {
  bookingLocked: boolean;
  paymentLocked: boolean;
  refundLocked: boolean;
  refundRows: Array<{ TrangThai: string; NgayHoanTien: Date | null }>;
  bookingStatus: string | null;
}

/**
 * Gateway double that, while "calling VNPAY", looks at the database through another connection with
 * `WITH (NOWAIT)`: if the cancel/callback/retry transaction were still open, those reads would hit its locks
 * (error 1222) or could not see its rows yet. It is the proof that no lock is held across the gateway call.
 */
class ProbingGateway implements RefundGateway {
  calls: RefundRequestInput[] = [];
  probes: Probe[] = [];
  constructor(
    private readonly result: RefundResult | (() => RefundResult) = { success: true, message: 'ok' },
    private readonly watch?: { maDatPhong: number; maThanhToan: number },
    private readonly delayMs = 0
  ) {}

  async requestRefund(input: RefundRequestInput): Promise<RefundResult> {
    this.calls.push(input);
    if (this.watch) this.probes.push(await this.probe(this.watch.maDatPhong, this.watch.maThanhToan));
    if (this.delayMs) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    return typeof this.result === 'function' ? this.result() : this.result;
  }

  private async probe(maDatPhong: number, maThanhToan: number): Promise<Probe> {
    const prisma = getPrismaClient();
    const locked = async (query: Prisma.Sql) => {
      try {
        await prisma.$queryRaw(query);
        return false;
      } catch {
        return true; // lock timeout / NOWAIT conflict: somebody still holds the row
      }
    };
    const bookingLocked = await locked(Prisma.sql`SELECT TrangThai FROM DAT_PHONG WITH (NOWAIT) WHERE MaDatPhong = ${maDatPhong}`);
    const paymentLocked = await locked(Prisma.sql`SELECT TrangThai FROM THANH_TOAN WITH (NOWAIT) WHERE MaThanhToan = ${maThanhToan}`);
    const refundLocked = await locked(Prisma.sql`SELECT TrangThai FROM HOAN_TIEN WITH (NOWAIT) WHERE MaThanhToan = ${maThanhToan}`);
    const refundRows = bookingLocked || refundLocked ? [] : await prisma.hOAN_TIEN.findMany({ where: { MaThanhToan: maThanhToan }, select: { TrangThai: true, NgayHoanTien: true } });
    const booking = bookingLocked ? null : await prisma.dAT_PHONG.findUnique({ where: { MaDatPhong: maDatPhong }, select: { TrangThai: true } });
    return { bookingLocked, paymentLocked, refundLocked, refundRows, bookingStatus: booking?.TrangThai ?? null };
  }
}

const accountIds: number[] = [];
let diaPhuongId = 0;
let hotelId = 0;
let policyId = 0;
let customerId = 0;
let otherCustomerId = 0;

beforeAll(async () => {
  const owner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  const other = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(owner.account.MaTaiKhoan, customer.account.MaTaiKhoan, other.account.MaTaiKhoan);
  customerId = customer.account.MaTaiKhoan;
  otherCustomerId = other.account.MaTaiKhoan;
  diaPhuongId = (await createTestDiaPhuong()).MaDiaPhuong;
  hotelId = (await createTestHotel(owner.account.MaTaiKhoan, diaPhuongId)).MaKhachSan;
  // >= 72h before check-in → 100%, >= 24h → 50%, otherwise 0%.
  policyId = (await createTestCancellationPolicy([
    { soGioTruocNhanPhong: 72, tyLeHoanTien: 100 },
    { soGioTruocNhanPhong: 24, tyLeHoanTien: 50 },
  ])).MaChinhSachHuy;
});

afterAll(async () => {
  const prisma = getPrismaClient();
  await prisma.hOAN_TIEN.deleteMany({ where: { THANH_TOAN: { DAT_PHONG: { MaKhachSan: hotelId } } } });
  await prisma.tHANH_TOAN.deleteMany({ where: { DAT_PHONG: { MaKhachSan: hotelId } } });
  await prisma.dAT_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });
  await deleteTestCancellationPolicy(policyId);
  await deleteTestHotel(hotelId);
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await deleteTestDiaPhuong(diaPhuongId);
});

const bookingsService = (gateway: RefundGateway) => new BookingsService(undefined, gateway);
const paymentsService = (gateway: RefundGateway) => new PaymentsService(undefined, gateway);

/** A paid, confirmed booking whose stay is `daysAhead` days away. */
const paidBooking = async (amount = 1_000_000, daysAhead = 5) => {
  const booking = await createTestBookingDirect(customerId, hotelId, policyId, addDays(daysAhead), addDays(daysAhead + 1), {
    trangThai: BOOKING_STATUS.CONFIRMED,
    tongTienPhong: amount,
  });
  const payment = await createTestPayment(booking.MaDatPhong, amount, PAYMENT_STATUS.SUCCESS, packedRef());
  return { booking, payment };
};

const prisma = () => getPrismaClient();
const refundsOf = (maThanhToan: number) => prisma().hOAN_TIEN.findMany({ where: { MaThanhToan: maThanhToan }, orderBy: { MaHoanTien: 'asc' } });
const bookingStatus = async (id: number) => (await prisma().dAT_PHONG.findUniqueOrThrow({ where: { MaDatPhong: id } })).TrangThai;

describe('cancel → refund lifecycle', () => {
  it('1. a cancellation that earns no refund (0% tier): booking "Đã hủy", no HOAN_TIEN, gateway untouched', async () => {
    const gateway = new ProbingGateway();
    const { booking, payment } = await paidBooking(1_000_000, 1);

    const result = await bookingsService(gateway).cancelBooking(booking.MaDatPhong, customerId, {}, IP);

    expect(result.TrangThai).toBe(BOOKING_STATUS.CANCELLED);
    expect(await refundsOf(payment.MaThanhToan)).toHaveLength(0);
    expect(gateway.calls).toHaveLength(0);
  });

  it('2. a refundable cancellation: exactly one HOAN_TIEN, "Chờ xử lý" while the gateway works, then "Thành công" with NgayHoanTien', async () => {
    const { booking, payment } = await paidBooking(1_000_000, 5);
    const gateway = new ProbingGateway({ success: true, message: 'ok' }, { maDatPhong: booking.MaDatPhong, maThanhToan: payment.MaThanhToan });

    const result = await bookingsService(gateway).cancelBooking(booking.MaDatPhong, customerId, {}, IP);

    // What the gateway call saw: the refund already committed as pending, the booking already cancelled.
    expect(gateway.calls).toHaveLength(1);
    expect(gateway.probes[0].refundRows).toEqual([{ TrangThai: REFUND_STATUS.PENDING, NgayHoanTien: null }]);
    expect(gateway.probes[0].bookingStatus).toBe(BOOKING_STATUS.CANCELLED);

    const refunds = await refundsOf(payment.MaThanhToan);
    expect(refunds).toHaveLength(1);
    expect(refunds[0].TrangThai).toBe(REFUND_STATUS.SUCCESS);
    expect(refunds[0].NgayHoanTien).toBeInstanceOf(Date);
    expect(refunds[0].NgayHoanTien!.getTime()).toBeGreaterThanOrEqual(refunds[0].NgayYeuCau.getTime());
    expect(Number(refunds[0].SoTienHoan)).toBe(1_000_000);
    expect(refunds[0].MaGiaoDichDoiTac).toBe(gateway.calls[0].refundRef);
    expect(result.ThanhToan[0].HoanTien).toHaveLength(1);
    expect(result.ThanhToan[0].HoanTien[0].TrangThai).toBe(REFUND_STATUS.SUCCESS);
  });

  it('3. the simulated refund fails: booking stays "Đã hủy", HOAN_TIEN is "Thất bại" without NgayHoanTien', async () => {
    const gateway = new ProbingGateway({ success: false, message: 'rejected' });
    const { booking, payment } = await paidBooking();

    const result = await bookingsService(gateway).cancelBooking(booking.MaDatPhong, customerId, {}, IP);

    expect(result.TrangThai).toBe(BOOKING_STATUS.CANCELLED);
    expect(await bookingStatus(booking.MaDatPhong)).toBe(BOOKING_STATUS.CANCELLED);
    const refunds = await refundsOf(payment.MaThanhToan);
    expect(refunds).toHaveLength(1);
    expect(refunds[0].TrangThai).toBe(REFUND_STATUS.FAILED);
    expect(refunds[0].NgayHoanTien).toBeNull();
  });

  it('a gateway that throws leaves the cancellation intact and ONE retryable "Thất bại" refund (never lost, never duplicated)', async () => {
    const gateway: RefundGateway = { requestRefund: async () => { throw new Error('socket hang up'); } };
    const { booking, payment } = await paidBooking();

    const result = await bookingsService(gateway).cancelBooking(booking.MaDatPhong, customerId, {}, IP);

    expect(result.TrangThai).toBe(BOOKING_STATUS.CANCELLED);
    const refunds = await refundsOf(payment.MaThanhToan);
    expect(refunds).toHaveLength(1);
    expect(refunds[0].TrangThai).toBe(REFUND_STATUS.FAILED); // no answer = a failed attempt, which can be retried
    expect(refunds[0].NgayHoanTien).toBeNull();
  });
});

describe('retry refund', () => {
  const failedRefund = async () => {
    const { booking, payment } = await paidBooking();
    const failing = new ProbingGateway({ success: false, message: 'temporary outage' });
    await bookingsService(failing).cancelBooking(booking.MaDatPhong, customerId, {}, IP);
    const [refund] = await refundsOf(payment.MaThanhToan);
    expect(refund.TrangThai).toBe(REFUND_STATUS.FAILED);
    return { booking, payment, refund, firstRefundRef: failing.calls[0].refundRef };
  };

  it('4. a failed retry reuses the same MaHoanTien: no new row, same amount, same refund reference', async () => {
    const { payment, refund, firstRefundRef } = await failedRefund();
    const gateway = new ProbingGateway({ success: false, message: 'still down' });

    const view = await paymentsService(gateway).retryRefund(refund.MaHoanTien, customerId, IP);

    expect(view.MaHoanTien).toBe(refund.MaHoanTien);
    expect(view.TrangThai).toBe(REFUND_STATUS.FAILED);
    expect(view.NgayHoanTien).toBeNull();
    const refunds = await refundsOf(payment.MaThanhToan);
    expect(refunds).toHaveLength(1);
    expect(Number(refunds[0].SoTienHoan)).toBe(Number(refund.SoTienHoan));
    expect(refunds[0].MaGiaoDichDoiTac).toBe(refund.MaGiaoDichDoiTac);
    expect(gateway.calls[0].refundRef).toBe(firstRefundRef); // same identity sent to the gateway
    expect(gateway.calls[0].amount).toBe(Number(refund.SoTienHoan));
  });

  it('5. a successful retry moves the very same row to "Thành công" with NgayHoanTien', async () => {
    const { booking, payment, refund } = await failedRefund();
    const gateway = new ProbingGateway({ success: true, message: 'ok' }, { maDatPhong: booking.MaDatPhong, maThanhToan: payment.MaThanhToan });

    const view = await paymentsService(gateway).retryRefund(refund.MaHoanTien, customerId, IP);

    expect(view.MaHoanTien).toBe(refund.MaHoanTien);
    expect(view.TrangThai).toBe(REFUND_STATUS.SUCCESS);
    expect(view.NgayHoanTien).not.toBeNull();
    const refunds = await refundsOf(payment.MaThanhToan);
    expect(refunds).toHaveLength(1);
    expect(refunds[0].TrangThai).toBe(REFUND_STATUS.SUCCESS);
    expect(refunds[0].NgayHoanTien).toBeInstanceOf(Date);
  });

  it('6. retrying a refund that already succeeded is a no-op: the gateway is not called, nothing changes', async () => {
    const { booking, payment } = await paidBooking();
    await bookingsService(new ProbingGateway()).cancelBooking(booking.MaDatPhong, customerId, {}, IP);
    const [done] = await refundsOf(payment.MaThanhToan);
    expect(done.TrangThai).toBe(REFUND_STATUS.SUCCESS);

    const gateway = new ProbingGateway();
    const view = await paymentsService(gateway).retryRefund(done.MaHoanTien, customerId, IP);

    expect(view.TrangThai).toBe(REFUND_STATUS.SUCCESS);
    expect(gateway.calls).toHaveLength(0);
    const [after] = await refundsOf(payment.MaThanhToan);
    expect(after.NgayHoanTien!.getTime()).toBe(done.NgayHoanTien!.getTime());
    expect(await refundsOf(payment.MaThanhToan)).toHaveLength(1);
  });

  it('only the booking owner can retry', async () => {
    const { refund } = await failedRefund();
    await expect(paymentsService(new ProbingGateway()).retryRefund(refund.MaHoanTien, otherCustomerId, IP)).rejects.toMatchObject({ statusCode: 403 });
    await expect(paymentsService(new ProbingGateway()).retryRefund(999_999_999, customerId, IP)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('an attempt still in flight ("Chờ xử lý", recent) is not started a second time', async () => {
    const { booking, payment } = await paidBooking();
    const pending = await createTestRefund(payment.MaThanhToan, 1_000_000, REFUND_STATUS.PENDING, null, new Date());
    const gateway = new ProbingGateway();

    await expect(paymentsService(gateway).retryRefund(pending.MaHoanTien, customerId, IP)).rejects.toMatchObject({ statusCode: 409 });

    expect(gateway.calls).toHaveLength(0);
    expect(await refundsOf(payment.MaThanhToan)).toHaveLength(1);
    expect(booking.MaDatPhong).toBeGreaterThan(0);
  });

  it('a "Chờ xử lý" row is never taken over, however old: there is no timestamp to tell a running attempt from a stuck one', async () => {
    const { payment } = await paidBooking();
    const requestedLongAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const old = await createTestRefund(payment.MaThanhToan, 1_000_000, REFUND_STATUS.PENDING, null, requestedLongAgo);
    const gateway = new ProbingGateway();

    await expect(paymentsService(gateway).retryRefund(old.MaHoanTien, customerId, IP)).rejects.toMatchObject({ statusCode: 409 });

    expect(gateway.calls).toHaveLength(0);
    const [after] = await refundsOf(payment.MaThanhToan);
    expect(after.TrangThai).toBe(REFUND_STATUS.PENDING);
    expect(after.NgayYeuCau.getTime()).toBe(requestedLongAgo.getTime());
  });

  it('a gateway call that gets no answer ends as a retryable "Thất bại" on the same row, re-sent with the same refund id', async () => {
    const { booking, payment } = await paidBooking();
    const silent: RefundGateway & { refs: string[] } = {
      refs: [],
      requestRefund: async (input) => { silent.refs.push(input.refundRef); throw new Error('timeout'); },
    };
    await bookingsService(silent).cancelBooking(booking.MaDatPhong, customerId, {}, IP);
    const [first] = await refundsOf(payment.MaThanhToan);
    expect(first.TrangThai).toBe(REFUND_STATUS.FAILED);

    const later = new ProbingGateway({ success: true, message: 'ok' });
    const view = await paymentsService(later).retryRefund(first.MaHoanTien, customerId, IP);

    expect(view.TrangThai).toBe(REFUND_STATUS.SUCCESS);
    expect(later.calls[0].refundRef).toBe(silent.refs[0]);
    expect(await refundsOf(payment.MaThanhToan)).toHaveLength(1);
  });

  it('NgayYeuCau is written once, when the refund is first requested: no number of retries changes it', async () => {
    const { booking, payment } = await paidBooking();
    const failing = new ProbingGateway({ success: false, message: 'down' });
    const beforeCancel = Date.now();
    await bookingsService(failing).cancelBooking(booking.MaDatPhong, customerId, {}, IP);
    const [created] = await refundsOf(payment.MaThanhToan);
    expect(created.NgayYeuCau.getTime()).toBeGreaterThanOrEqual(beforeCancel - 2000);
    expect(created.NgayHoanTien).toBeNull();

    // Pull it far into the past so any code that "stamps now" on retry would be unmistakable.
    const requestedAt = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await prisma().hOAN_TIEN.update({ where: { MaHoanTien: created.MaHoanTien }, data: { NgayYeuCau: requestedAt } });

    for (let attempt = 1; attempt <= 3; attempt++) {
      await paymentsService(new ProbingGateway({ success: false, message: 'still down' })).retryRefund(created.MaHoanTien, customerId, IP);
      const [row] = await refundsOf(payment.MaThanhToan);
      expect(row.TrangThai).toBe(REFUND_STATUS.FAILED);
      expect(row.NgayYeuCau.getTime()).toBe(requestedAt.getTime()); // unchanged after every failed retry
      expect(row.NgayHoanTien).toBeNull(); // only a success may set it
    }

    await paymentsService(new ProbingGateway({ success: true, message: 'ok' })).retryRefund(created.MaHoanTien, customerId, IP);
    const [done] = await refundsOf(payment.MaThanhToan);
    expect(done.TrangThai).toBe(REFUND_STATUS.SUCCESS);
    expect(done.NgayYeuCau.getTime()).toBe(requestedAt.getTime()); // still the original request time
    expect(done.NgayHoanTien!.getTime()).toBeGreaterThan(requestedAt.getTime()); // set now, by the success
  });
});

describe('concurrency', () => {
  it('7. two simultaneous cancel requests: one cancellation, one HOAN_TIEN, one gateway call', async () => {
    const { booking, payment } = await paidBooking();
    const gateway = new ProbingGateway({ success: true, message: 'ok' }, undefined, 80);
    const service = bookingsService(gateway);

    const results = await Promise.allSettled([
      service.cancelBooking(booking.MaDatPhong, customerId, {}, IP),
      service.cancelBooking(booking.MaDatPhong, customerId, {}, IP),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect([400, 409]).toContain(rejected[0].reason.statusCode);
    expect(await bookingStatus(booking.MaDatPhong)).toBe(BOOKING_STATUS.CANCELLED);
    const refunds = await refundsOf(payment.MaThanhToan);
    expect(refunds).toHaveLength(1);
    expect(refunds[0].TrangThai).toBe(REFUND_STATUS.SUCCESS);
    expect(gateway.calls).toHaveLength(1);
  });

  it('8. two simultaneous retries: the gateway is reached once, a single row ends "Thành công"', async () => {
    const { booking, payment } = await paidBooking();
    await bookingsService(new ProbingGateway({ success: false, message: 'down' })).cancelBooking(booking.MaDatPhong, customerId, {}, IP);
    const [refund] = await refundsOf(payment.MaThanhToan);

    const gateway = new ProbingGateway({ success: true, message: 'ok' }, undefined, 120);
    const service = paymentsService(gateway);
    const results = await Promise.allSettled([
      service.retryRefund(refund.MaHoanTien, customerId, IP),
      service.retryRefund(refund.MaHoanTien, customerId, IP),
      service.retryRefund(refund.MaHoanTien, customerId, IP),
    ]);

    expect(gateway.calls).toHaveLength(1);
    expect(results.some((r) => r.status === 'fulfilled' && r.value.TrangThai === REFUND_STATUS.SUCCESS)).toBe(true);
    for (const r of results) {
      if (r.status === 'rejected') expect(r.reason.statusCode).toBe(409);
    }
    const refunds = await refundsOf(payment.MaThanhToan);
    expect(refunds).toHaveLength(1);
    expect(refunds.filter((r) => r.TrangThai === REFUND_STATUS.SUCCESS)).toHaveLength(1);
  });

  it('cancel and retry racing: still one refund row, never two successful refunds for the payment', async () => {
    const { booking, payment } = await paidBooking();
    const gateway = new ProbingGateway({ success: true, message: 'ok' }, undefined, 100);
    const bookings = bookingsService(gateway);
    const payments = paymentsService(gateway);

    // A retry aimed at a refund that does not exist yet (404), fired together with the cancel, then again once it does.
    const cancelling = bookings.cancelBooking(booking.MaDatPhong, customerId, {}, IP);
    let retrying: Promise<unknown> = Promise.resolve();
    for (let attempt = 0; attempt < 20; attempt++) {
      const [existing] = await refundsOf(payment.MaThanhToan);
      if (existing) {
        retrying = payments.retryRefund(existing.MaHoanTien, customerId, IP).catch((e) => e);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await Promise.all([cancelling, retrying]);

    const refunds = await refundsOf(payment.MaThanhToan);
    expect(refunds).toHaveLength(1);
    expect(refunds.filter((r) => r.TrangThai === REFUND_STATUS.SUCCESS).length).toBeLessThanOrEqual(1);
    expect(refunds[0].TrangThai).toBe(REFUND_STATUS.SUCCESS);
    expect(gateway.calls).toHaveLength(1); // the retry met an attempt in flight (409) or an already settled refund
    expect(await bookingStatus(booking.MaDatPhong)).toBe(BOOKING_STATUS.CANCELLED);
  });
});

describe('amounts', () => {
  it('9. a refund can never exceed the payment: 50% and 100% tiers are exact, and earlier refunds are deducted', async () => {
    const half = await paidBooking(1_000_001, 2); // 24h tier → 50%
    await bookingsService(new ProbingGateway()).cancelBooking(half.booking.MaDatPhong, customerId, {}, IP);
    const [halfRefund] = await refundsOf(half.payment.MaThanhToan);
    expect(Number(halfRefund.SoTienHoan)).toBe(500_001); // rounded to the đồng, never above the payment
    expect(Number(halfRefund.SoTienHoan)).toBeLessThanOrEqual(1_000_001);

    // 700.000 of 1.000.000 is already refunded on this payment: a 100% cancellation may only add the remaining 300.000.
    const partly = await paidBooking(1_000_000, 5);
    await createTestRefund(partly.payment.MaThanhToan, 700_000, REFUND_STATUS.SUCCESS);
    await bookingsService(new ProbingGateway()).cancelBooking(partly.booking.MaDatPhong, customerId, {}, IP);
    const rows = await refundsOf(partly.payment.MaThanhToan);
    expect(rows).toHaveLength(2);
    expect(rows.reduce((sum, r) => sum + Number(r.SoTienHoan), 0)).toBe(1_000_000);

    // Nothing left to refund → the cancellation still succeeds and no further row appears.
    const none = await paidBooking(1_000_000, 5);
    await createTestRefund(none.payment.MaThanhToan, 1_000_000, REFUND_STATUS.SUCCESS);
    const gateway = new ProbingGateway();
    const result = await bookingsService(gateway).cancelBooking(none.booking.MaDatPhong, customerId, {}, IP);
    expect(result.TrangThai).toBe(BOOKING_STATUS.CANCELLED);
    expect(await refundsOf(none.payment.MaThanhToan)).toHaveLength(1);
    expect(gateway.calls).toHaveLength(0);
  });

  it('10. a booking with a total of 0đ has no THANH_TOAN, and cancelling it never creates a HOAN_TIEN', async () => {
    const booking = await createTestBookingDirect(customerId, hotelId, policyId, addDays(5), addDays(6), {
      trangThai: BOOKING_STATUS.CONFIRMED,
      tongTienPhong: 0,
    });
    const gateway = new ProbingGateway();

    const result = await bookingsService(gateway).cancelBooking(booking.MaDatPhong, customerId, {}, IP);

    expect(result.TrangThai).toBe(BOOKING_STATUS.CANCELLED);
    expect(result.ThanhToan).toEqual([]);
    expect(await prisma().tHANH_TOAN.count({ where: { MaDatPhong: booking.MaDatPhong } })).toBe(0);
    expect(await prisma().hOAN_TIEN.count({ where: { THANH_TOAN: { MaDatPhong: booking.MaDatPhong } } })).toBe(0);
    expect(gateway.calls).toHaveLength(0);
  });
});

describe('no lock is held while the refund simulation runs', () => {
  const expectNoLocks = (probe: Probe) => {
    expect(probe.bookingLocked).toBe(false);
    expect(probe.paymentLocked).toBe(false);
    expect(probe.refundLocked).toBe(false);
  };

  it('cancel: booking, payment and refund rows are all readable (NOWAIT) from another connection during the gateway call', async () => {
    const { booking, payment } = await paidBooking();
    const gateway = new ProbingGateway({ success: true, message: 'ok' }, { maDatPhong: booking.MaDatPhong, maThanhToan: payment.MaThanhToan });

    await bookingsService(gateway).cancelBooking(booking.MaDatPhong, customerId, {}, IP);

    expect(gateway.probes).toHaveLength(1);
    expectNoLocks(gateway.probes[0]);
    expect(gateway.probes[0].refundRows.map((r) => r.TrangThai)).toEqual([REFUND_STATUS.PENDING]);
  });

  it('retry: the claim is committed ("Chờ xử lý" visible) and nothing is locked while the gateway runs', async () => {
    const { booking, payment } = await paidBooking();
    await bookingsService(new ProbingGateway({ success: false, message: 'down' })).cancelBooking(booking.MaDatPhong, customerId, {}, IP);
    const [refund] = await refundsOf(payment.MaThanhToan);
    const gateway = new ProbingGateway({ success: true, message: 'ok' }, { maDatPhong: booking.MaDatPhong, maThanhToan: payment.MaThanhToan });

    await paymentsService(gateway).retryRefund(refund.MaHoanTien, customerId, IP);

    expect(gateway.probes).toHaveLength(1);
    expectNoLocks(gateway.probes[0]);
    expect(gateway.probes[0].refundRows).toEqual([{ TrangThai: REFUND_STATUS.PENDING, NgayHoanTien: null }]);
  });

  it('late payment on a dead booking: the 100% refund is committed as pending first, no lock while the gateway runs, then settled', async () => {
    const txnRef = `LIFELATE${Date.now()}`;
    const booking = await createTestBookingDirect(customerId, hotelId, policyId, addDays(5), addDays(6), {
      trangThai: BOOKING_STATUS.CANCELLED,
      tongTienPhong: 700_000,
    });
    const payment = await createTestPayment(booking.MaDatPhong, 700_000, PAYMENT_STATUS.PENDING, txnRef);
    const gateway = new ProbingGateway({ success: true, message: 'ok' }, { maDatPhong: booking.MaDatPhong, maThanhToan: payment.MaThanhToan });

    const params = {
      vnp_TxnRef: txnRef,
      vnp_Amount: String(700_000 * 100),
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: '900777',
      vnp_PayDate: '20260101000000',
    };
    const query = { ...params, vnp_SecureHash: signVnpayParams(params, env.VNPAY_HASH_SECRET) };
    const service = paymentsService(gateway);

    const outcome = await service.handleCallback(query, IP);
    expect(outcome.rspCode).toBe('00');
    expect(gateway.probes).toHaveLength(1);
    expectNoLocks(gateway.probes[0]);
    expect(gateway.probes[0].refundRows).toEqual([{ TrangThai: REFUND_STATUS.PENDING, NgayHoanTien: null }]);

    const refunds = await refundsOf(payment.MaThanhToan);
    expect(refunds).toHaveLength(1);
    expect(refunds[0].TrangThai).toBe(REFUND_STATUS.SUCCESS);
    expect(Number(refunds[0].SoTienHoan)).toBe(700_000);

    // The same callback again changes nothing and refunds nothing more.
    const again = await service.handleCallback(query, IP);
    expect(again.rspCode).toBe('02');
    expect(await refundsOf(payment.MaThanhToan)).toHaveLength(1);
    expect(gateway.calls).toHaveLength(1);
  });
});
