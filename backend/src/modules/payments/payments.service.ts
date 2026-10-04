import { PaymentsRepository } from './payments.repository';
import { getPrismaClient } from '../../config/prisma';
import { AppError } from '../../common/errors/app-error';
import { BOOKING_STATUS } from '../../common/constants/hotel-status';
import { PAYMENT_STATUS, PAYMENT_METHOD, REFUND_STATUS } from '../../common/constants/payment';
import { expireStalePendingBookings } from '../bookings/booking-expiry';
import { buildPaymentUrl, verifyVnpaySignature, generateTxnRef, encodeGatewayRef, VNPAY_IPN_CODE, toVnpayDate } from './vnpay';
import { RefundsRepository, type PendingRefund } from './refunds.repository';
import { RefundProcessor } from './refund-processor';
import type { RefundGateway } from './refund-gateway';
import { VnpayRefundGateway } from './refund-gateway';

const toNumber = (value: unknown): number => Number(value);

export interface CreatePaymentResult {
  maThanhToan: number;
  maGiaoDichDoiTac: string;
  paymentUrl: string;
}

export interface CallbackOutcome {
  rspCode: string;
  message: string;
  /** Only meaningful for the return-URL redirect — irrelevant to the IPN JSON response. */
  redirectStatus: 'success' | 'failed' | 'unknown';
  maDatPhong: number | null;
}

export interface RefundView {
  MaHoanTien: number;
  SoTienHoan: number;
  LyDoHoanTien: string;
  TrangThai: string;
  NgayYeuCau: string;
  NgayHoanTien: string | null;
}

export interface PaymentStatusResponse {
  MaDatPhong: number;
  MaXacNhanDatPhong: string;
  TrangThaiDatPhong: string;
  ThanhToan: Array<{
    MaThanhToan: number;
    SoTien: number;
    PhuongThucThanhToan: string;
    TrangThai: string;
    ThoiGianGiaoDich: string;
    HoanTien: RefundView[];
  }>;
}

export class PaymentsService {
  constructor(
    private readonly repository: PaymentsRepository = new PaymentsRepository(),
    refundGateway: RefundGateway = new VnpayRefundGateway(),
    private readonly refunds: RefundsRepository = new RefundsRepository(),
    private readonly refundProcessor: RefundProcessor = new RefundProcessor(refundGateway, refunds)
  ) {}

  async createVnpayPayment(maDatPhong: number, requesterId: number, ipAddr: string): Promise<CreatePaymentResult> {
    await expireStalePendingBookings(getPrismaClient());

    // The booking row stays locked for the whole check-then-insert, so double clicks, retries and parallel
    // tabs are serialized: at most one "Chờ xử lý" payment exists per booking at any time.
    return this.repository.runInTransaction(async (tx) => {
      const booking = await this.repository.lockBookingById(tx, maDatPhong);
      if (!booking) throw AppError.notFound('Không tìm thấy đặt phòng');
      if (booking.MaTaiKhoanKhachHang !== requesterId) {
        throw AppError.forbidden('Bạn không có quyền thanh toán đặt phòng này');
      }
      if (booking.TrangThai !== BOOKING_STATUS.PENDING_PAYMENT) {
        throw AppError.badRequest(`Không thể tạo yêu cầu thanh toán — đặt phòng đang ở trạng thái "${booking.TrangThai}"`);
      }
      // Defensive — TrangThai should already be CONFIRMED once a payment succeeds, so this only guards a race.
      const existingSuccess = await this.repository.findSuccessfulPaymentTx(tx, maDatPhong);
      if (existingSuccess) throw AppError.badRequest('Đặt phòng đã được thanh toán thành công');

      // The charge is ALWAYS re-read from DAT_PHONG here — nothing from the
      // request body feeds into `amount` (M6 §1: "Backend phải tự lấy số
      // tiền từ DAT_PHONG. Không tin amount từ frontend").
      const amount = toNumber(booking.TongTienThanhToan);
      if (amount <= 0) throw AppError.badRequest('Đặt phòng có tổng thanh toán bằng 0, không cần thanh toán qua cổng');

      // An attempt is already open: hand it back instead of opening a second one. The URL is rebuilt from
      // the stored attempt (same txnRef, amount and creation time), so it is the same payment.
      const pending = await this.repository.findPendingPaymentTx(tx, maDatPhong);
      if (pending) {
        const paymentUrl = buildPaymentUrl({
          txnRef: pending.MaGiaoDichDoiTac,
          amount: toNumber(pending.SoTien),
          orderInfo: `Thanh toan dat phong ${booking.MaXacNhanDatPhong}`,
          ipAddr,
          createDate: pending.ThoiGianGiaoDich,
        });
        return { maThanhToan: pending.MaThanhToan, maGiaoDichDoiTac: pending.MaGiaoDichDoiTac, paymentUrl };
      }

      const txnRef = generateTxnRef();
      const now = new Date();
      const payment = await this.repository.insertPaymentTx(tx, {
        maDatPhong,
        soTien: amount,
        phuongThucThanhToan: PAYMENT_METHOD.VNPAY,
        maGiaoDichDoiTac: txnRef,
        trangThai: PAYMENT_STATUS.PENDING,
        thoiGianGiaoDich: now,
      });

      const paymentUrl = buildPaymentUrl({
        txnRef,
        amount,
        orderInfo: `Thanh toan dat phong ${booking.MaXacNhanDatPhong}`,
        ipAddr,
        createDate: now,
      });

      return { maThanhToan: payment.MaThanhToan, maGiaoDichDoiTac: txnRef, paymentUrl };
    });
  }

  /**
   * Shared by both the return-URL redirect handler and the IPN handler
   * (M6 §1 — "callback lặp lại không được tạo thanh toán kép hoặc cập
   * nhật tài chính sai"). Idempotent: a payment already in a terminal
   * state (Success/Failed) is never re-mutated — a repeat callback with
   * the same vnp_TxnRef just re-reports the stored outcome.
   */
  async handleCallback(query: Record<string, unknown>, ipAddr: string): Promise<CallbackOutcome> {
    if (!verifyVnpaySignature(query)) {
      return { rspCode: VNPAY_IPN_CODE.INVALID_SIGNATURE, message: 'Invalid signature', redirectStatus: 'failed', maDatPhong: null };
    }

    const txnRef = String(query.vnp_TxnRef ?? '');
    if (!txnRef) {
      return { rspCode: VNPAY_IPN_CODE.ORDER_NOT_FOUND, message: 'Missing vnp_TxnRef', redirectStatus: 'failed', maDatPhong: null };
    }

    // Phase 1 — everything that is a database decision, in one transaction. A refund owed because the payment
    // arrived after the booking was gone is only RECORDED here ("Chờ xử lý"); the gateway is not called.
    const { outcome, pendingRefund } = await this.repository.runInTransaction(async (tx) => {
      let pendingRefund: PendingRefund | null = null;
      const done = (outcome: CallbackOutcome) => ({ outcome, pendingRefund });

      const payment = await this.repository.findPaymentByTxnRef(tx, txnRef);
      if (!payment) {
        return done({ rspCode: VNPAY_IPN_CODE.ORDER_NOT_FOUND, message: 'Order not found', redirectStatus: 'failed', maDatPhong: null });
      }

      if (payment.TrangThai !== PAYMENT_STATUS.PENDING) {
        // Duplicate callback for an already-finalized payment — report the
        // stored outcome again, touch nothing (this is the idempotency guard).
        return done({
          rspCode: VNPAY_IPN_CODE.ORDER_ALREADY_CONFIRMED,
          message: 'Order already confirmed',
          redirectStatus: payment.TrangThai === PAYMENT_STATUS.SUCCESS ? 'success' : 'failed',
          maDatPhong: payment.MaDatPhong,
        });
      }

      const expectedVnpAmount = Math.round(toNumber(payment.SoTien) * 100);
      const receivedVnpAmount = Number(query.vnp_Amount);
      if (!Number.isFinite(receivedVnpAmount) || receivedVnpAmount !== expectedVnpAmount) {
        // Leave the payment PENDING — this could be a malformed retry; VNPAY may resend with correct data.
        return done({ rspCode: VNPAY_IPN_CODE.INVALID_AMOUNT, message: 'Invalid amount', redirectStatus: 'failed', maDatPhong: payment.MaDatPhong });
      }

      const now = new Date();
      const isSuccess = String(query.vnp_ResponseCode) === '00' && String(query.vnp_TransactionStatus ?? '00') === '00';

      if (!isSuccess) {
        await this.repository.markPaymentOutcome(tx, payment.MaThanhToan, PAYMENT_STATUS.FAILED);
        // Per M6 §1 — payment failure must never confirm the booking; it is
        // simply left as-is (still PENDING_PAYMENT, retryable, or already
        // expired by the lazy sweep above).
        return done({ rspCode: VNPAY_IPN_CODE.SUCCESS, message: 'Confirm Success', redirectStatus: 'failed', maDatPhong: payment.MaDatPhong });
      }

      const packedRef = encodeGatewayRef(txnRef, String(query.vnp_TransactionNo ?? ''), String(query.vnp_PayDate ?? toVnpayDate(now)));
      await this.repository.markPaymentOutcome(tx, payment.MaThanhToan, PAYMENT_STATUS.SUCCESS, packedRef);

      const confirmed = await this.repository.confirmBookingIfPending(tx, payment.MaDatPhong, now);
      if (confirmed === 0) {
        // The booking is no longer PENDING_PAYMENT — it expired or was
        // cancelled while this payment was in flight. VNPAY still reports
        // success, so the money really was captured for a booking that is
        // no longer valid: owe the customer 100% back (never silently keep the
        // money, never silently confirm a dead booking either — see M6 report
        // §2/§4). Recorded as ONE "Chờ xử lý" refund, sent to the gateway below.
        pendingRefund = await this.refunds.openPendingRefund(
          tx,
          { MaThanhToan: payment.MaThanhToan, SoTien: payment.SoTien, MaGiaoDichDoiTac: packedRef },
          toNumber(payment.SoTien),
          'Thanh toán được VNPAY xác nhận sau khi đặt phòng đã hết hạn/hủy — hoàn 100%',
          now
        );
        return done({ rspCode: VNPAY_IPN_CODE.SUCCESS, message: 'Confirm Success', redirectStatus: 'failed', maDatPhong: payment.MaDatPhong });
      }

      return done({ rspCode: VNPAY_IPN_CODE.SUCCESS, message: 'Confirm Success', redirectStatus: 'success', maDatPhong: payment.MaDatPhong });
    });

    // Phase 2 — committed, no lock held: ask the gateway and settle the refund row.
    if (pendingRefund) await this.refundProcessor.process(pendingRefund, ipAddr);
    return outcome;
  }

  async getPaymentStatus(maDatPhong: number, requesterId: number): Promise<PaymentStatusResponse> {
    await expireStalePendingBookings(getPrismaClient());

    const booking = await this.repository.findBookingById(maDatPhong);
    if (!booking) throw AppError.notFound('Không tìm thấy đặt phòng');
    if (booking.MaTaiKhoanKhachHang !== requesterId) {
      throw AppError.forbidden('Bạn không có quyền xem thanh toán của đặt phòng này');
    }

    const payments = await this.repository.findPaymentsWithRefundsForBooking(maDatPhong);
    return {
      MaDatPhong: booking.MaDatPhong,
      MaXacNhanDatPhong: booking.MaXacNhanDatPhong,
      TrangThaiDatPhong: booking.TrangThai,
      ThanhToan: payments.map((p) => ({
        MaThanhToan: p.MaThanhToan,
        SoTien: toNumber(p.SoTien),
        PhuongThucThanhToan: p.PhuongThucThanhToan,
        TrangThai: p.TrangThai,
        ThoiGianGiaoDich: p.ThoiGianGiaoDich.toISOString(),
        HoanTien: p.HOAN_TIEN.map((h) => ({
          MaHoanTien: h.MaHoanTien,
          SoTienHoan: toNumber(h.SoTienHoan),
          LyDoHoanTien: h.LyDoHoanTien,
          TrangThai: h.TrangThai,
          NgayYeuCau: h.NgayYeuCau.toISOString(),
          NgayHoanTien: h.NgayHoanTien ? h.NgayHoanTien.toISOString() : null,
        })),
      })),
    };
  }

  /**
   * Retries a refund on the SAME HOAN_TIEN row — never a new one, never a different amount.
   *   Thành công          → no-op, the gateway is not called again.
   *   Thất bại            → claimed (→ "Chờ xử lý") and re-sent with the same refund id.
   *   Chờ xử lý           → 409: an attempt is under way (cancel, callback or another retry).
   * NgayYeuCau is never touched: it stays the date the refund was first requested.
   * The claim is a short transaction under the row lock; the gateway is called after it commits, so two
   * simultaneous retries cannot both reach the gateway and no lock is held while waiting for it.
   */
  async retryRefund(maHoanTien: number, requesterId: number, ipAddr: string): Promise<RefundView> {
    const claimed = await this.refunds.runInTransaction(async (tx) => {
      const refund = await this.refunds.lockRefund(tx, maHoanTien);
      if (!refund) throw AppError.notFound('Không tìm thấy yêu cầu hoàn tiền');
      if (refund.THANH_TOAN.DAT_PHONG.MaTaiKhoanKhachHang !== requesterId) {
        throw AppError.forbidden('Bạn không có quyền thao tác trên yêu cầu hoàn tiền này');
      }
      if (refund.TrangThai === REFUND_STATUS.SUCCESS) return null;

      if (refund.TrangThai === REFUND_STATUS.PENDING) {
        throw AppError.conflict('Yêu cầu hoàn tiền đang được xử lý. Vui lòng kiểm tra lại sau ít phút');
      }
      if (refund.TrangThai !== REFUND_STATUS.FAILED) {
        throw AppError.badRequest(`Không thể thử lại yêu cầu hoàn tiền ở trạng thái "${refund.TrangThai}"`);
      }

      // A refund may never push the payment's refunds above what the customer paid.
      const others = await this.refunds.sumReservedRefunds(tx, refund.MaThanhToan, refund.MaHoanTien);
      if (others + toNumber(refund.SoTienHoan) > toNumber(refund.THANH_TOAN.SoTien)) {
        throw AppError.badRequest('Số tiền hoàn vượt quá số tiền đã thanh toán');
      }

      if (!(await this.refunds.claimForRetry(tx, maHoanTien))) {
        throw AppError.conflict('Yêu cầu hoàn tiền vừa được xử lý bởi thao tác khác');
      }
      return {
        maHoanTien,
        packedOriginalRef: refund.THANH_TOAN.MaGiaoDichDoiTac,
        refundRef: refund.MaGiaoDichDoiTac,
        amount: toNumber(refund.SoTienHoan),
      } satisfies PendingRefund;
    });

    if (claimed) await this.refundProcessor.process(claimed, ipAddr);

    const latest = await this.refunds.findRefund(maHoanTien);
    return this.toRefundView(latest!);
  }

  private toRefundView(refund: { MaHoanTien: number; SoTienHoan: unknown; LyDoHoanTien: string; TrangThai: string; NgayYeuCau: Date; NgayHoanTien: Date | null }): RefundView {
    return {
      MaHoanTien: refund.MaHoanTien,
      SoTienHoan: toNumber(refund.SoTienHoan),
      LyDoHoanTien: refund.LyDoHoanTien,
      TrangThai: refund.TrangThai,
      NgayYeuCau: refund.NgayYeuCau.toISOString(),
      NgayHoanTien: refund.NgayHoanTien ? refund.NgayHoanTien.toISOString() : null,
    };
  }
}
