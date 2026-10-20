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
import { ConfiguredRefundGateway } from './simulated-refund-gateway';
import { getPaymentProvider, type PaymentProvider } from './payment-provider';

const toNumber = (value: unknown): number => Number(value);

export interface CreatePaymentResult {
  maThanhToan: number;
  maGiaoDichDoiTac: string;
  paymentUrl: string;
}

export interface CallbackOutcome {
  rspCode: string;
  message: string;
  /** Chỉ dùng cho chuyển hướng về URL trả kết quả */
  redirectStatus: 'success' | 'failed' | 'unknown';
  maDatPhong: number | null;
}

/** Kết quả thanh toán giả lập */
export interface SimulatedPaymentResult {
  maThanhToan: number;
  maGiaoDichDoiTac: string;
  maDatPhong: number;
  maXacNhanDatPhong: string;
  soTien: number;
  trangThaiThanhToan: string;
  trangThaiDatPhong: string;
  thoiGianThanhToan: string;
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
    refundGateway: RefundGateway = new ConfiguredRefundGateway(),
    private readonly refunds: RefundsRepository = new RefundsRepository(),
    private readonly refundProcessor: RefundProcessor = new RefundProcessor(refundGateway, refunds)
  ) {}

  async createVnpayPayment(maDatPhong: number, requesterId: number, ipAddr: string): Promise<CreatePaymentResult> {
    await expireStalePendingBookings(getPrismaClient());

    // Khóa đơn trong lúc kiểm tra và tạo để chỉ có một lần thanh toán đang chờ
    return this.repository.runInTransaction(async (tx) => {
      const { booking, amount } = await this.lockPayableBooking(tx, maDatPhong, requesterId);

      // Trả lại lần thanh toán đang mở thay vì tạo mới
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

  /** Khóa đơn và kiểm tra quyền thanh toán, số tiền lấy lại từ CSDL */
  private async lockPayableBooking(tx: Parameters<Parameters<PaymentsRepository['runInTransaction']>[0]>[0], maDatPhong: number, requesterId: number) {
    const booking = await this.repository.lockBookingById(tx, maDatPhong);
    if (!booking) throw AppError.notFound('Không tìm thấy đặt phòng');
    if (booking.MaTaiKhoanKhachHang !== requesterId) {
      throw AppError.forbidden('Bạn không có quyền thanh toán đặt phòng này');
    }
    if (booking.TrangThai !== BOOKING_STATUS.PENDING_PAYMENT) {
      throw AppError.badRequest(`Không thể tạo yêu cầu thanh toán — đặt phòng đang ở trạng thái "${booking.TrangThai}"`);
    }
    // Chỉ phòng hờ tranh chấp
    const existingSuccess = await this.repository.findSuccessfulPaymentTx(tx, maDatPhong);
    if (existingSuccess) throw AppError.badRequest('Đặt phòng đã được thanh toán thành công');

    // Số tiền không lấy từ body yêu cầu
    const amount = toNumber(booking.TongTienThanhToan);
    if (amount <= 0) throw AppError.badRequest('Đặt phòng có tổng thanh toán bằng 0, không cần thanh toán qua cổng');
    return { booking, amount };
  }

  getConfig(): { provider: PaymentProvider } {
    return { provider: getPaymentProvider() };
  }

  /** Thanh toán giả lập trong một giao dịch */
  async paySimulated(maDatPhong: number, requesterId: number): Promise<SimulatedPaymentResult> {
    if (getPaymentProvider() !== 'simulated') {
      throw AppError.badRequest('Thanh toán mô phỏng đang tắt (PAYMENT_PROVIDER không phải "simulated")');
    }
    await expireStalePendingBookings(getPrismaClient());

    return this.repository.runInTransaction(async (tx) => {
      const { booking, amount } = await this.lockPayableBooking(tx, maDatPhong, requesterId);
      const now = new Date();
      const txnRef = generateTxnRef();
      const transactionNo = String(10_000_000 + Math.floor(Math.random() * 89_999_999));
      const packedRef = encodeGatewayRef(txnRef, transactionNo, toVnpayDate(now));

      // Đóng lần thanh toán đang chờ của cổng thật
      const pending = await this.repository.findPendingPaymentTx(tx, maDatPhong);
      const payment = pending
        ? await this.repository.markPaymentOutcome(tx, pending.MaThanhToan, PAYMENT_STATUS.SUCCESS, packedRef)
        : await this.repository.insertPaymentTx(tx, {
            maDatPhong,
            soTien: amount,
            phuongThucThanhToan: PAYMENT_METHOD.VNPAY_SIMULATED,
            maGiaoDichDoiTac: packedRef,
            trangThai: PAYMENT_STATUS.SUCCESS,
            thoiGianGiaoDich: now,
          });

      const confirmed = await this.repository.confirmBookingIfPending(tx, maDatPhong, now);
      if (confirmed === 0) throw AppError.conflict('Đặt phòng đã đổi trạng thái trước khi thanh toán — vui lòng tải lại');

      return {
        maThanhToan: payment.MaThanhToan,
        maGiaoDichDoiTac: txnRef,
        maDatPhong,
        maXacNhanDatPhong: booking.MaXacNhanDatPhong,
        soTien: toNumber(payment.SoTien),
        trangThaiThanhToan: PAYMENT_STATUS.SUCCESS,
        trangThaiDatPhong: BOOKING_STATUS.CONFIRMED,
        thoiGianThanhToan: now.toISOString(),
      };
    });
  }

  /** Xử lý callback VNPAY một lần, an toàn khi gọi lặp */
  async handleCallback(query: Record<string, unknown>, ipAddr: string): Promise<CallbackOutcome> {
    if (!verifyVnpaySignature(query)) {
      return { rspCode: VNPAY_IPN_CODE.INVALID_SIGNATURE, message: 'Invalid signature', redirectStatus: 'failed', maDatPhong: null };
    }

    const txnRef = String(query.vnp_TxnRef ?? '');
    if (!txnRef) {
      return { rspCode: VNPAY_IPN_CODE.ORDER_NOT_FOUND, message: 'Missing vnp_TxnRef', redirectStatus: 'failed', maDatPhong: null };
    }

    // Giai đoạn 1: quyết định trong một giao dịch, chưa gọi cổng
    const { outcome, pendingRefund } = await this.repository.runInTransaction(async (tx) => {
      let pendingRefund: PendingRefund | null = null;
      const done = (outcome: CallbackOutcome) => ({ outcome, pendingRefund });

      const payment = await this.repository.findPaymentByTxnRef(tx, txnRef);
      if (!payment) {
        return done({ rspCode: VNPAY_IPN_CODE.ORDER_NOT_FOUND, message: 'Order not found', redirectStatus: 'failed', maDatPhong: null });
      }

      if (payment.TrangThai !== PAYMENT_STATUS.PENDING) {
        // Callback trùng chỉ báo lại kết quả đã lưu
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
        // Giữ thanh toán ở trạng thái chờ
        return done({ rspCode: VNPAY_IPN_CODE.INVALID_AMOUNT, message: 'Invalid amount', redirectStatus: 'failed', maDatPhong: payment.MaDatPhong });
      }

      const now = new Date();
      const isSuccess = String(query.vnp_ResponseCode) === '00' && String(query.vnp_TransactionStatus ?? '00') === '00';

      if (!isSuccess) {
        await this.repository.markPaymentOutcome(tx, payment.MaThanhToan, PAYMENT_STATUS.FAILED);
        // Thanh toán thất bại không xác nhận đơn
        return done({ rspCode: VNPAY_IPN_CODE.SUCCESS, message: 'Confirm Success', redirectStatus: 'failed', maDatPhong: payment.MaDatPhong });
      }

      const packedRef = encodeGatewayRef(txnRef, String(query.vnp_TransactionNo ?? ''), String(query.vnp_PayDate ?? toVnpayDate(now)));
      await this.repository.markPaymentOutcome(tx, payment.MaThanhToan, PAYMENT_STATUS.SUCCESS, packedRef);

      const confirmed = await this.repository.confirmBookingIfPending(tx, payment.MaDatPhong, now);
      if (confirmed === 0) {
        // Đơn đã hết hiệu lực nên tạo yêu cầu hoàn tiền đầy đủ
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

    // Giai đoạn 2: gọi cổng và cập nhật hoàn tiền
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

  /** Thử lại hoàn tiền trên cùng một dòng */
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

      // Hoàn tiền không vượt quá số đã thanh toán
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
