import { BOOKING_STATUS } from '../bookings/status';
import type { PaymentStatusResponse } from './types';

/** Trạng thái thanh toán và hoàn tiền */
export const PAYMENT_STATUS = { PENDING: 'Chờ xử lý', SUCCESS: 'Thành công', FAILED: 'Thất bại' } as const;
export const REFUND_STATUS = { PENDING: 'Chờ xử lý', SUCCESS: 'Thành công', FAILED: 'Thất bại' } as const;

export type RefundOutcome = 'refunded' | 'pending' | 'failed' | 'none';

export type PaymentResult =
  | { kind: 'confirmed' }
  /** Đơn bị hủy dù cổng đã thu tiền */
  | { kind: 'cancelled-paid'; paid: number; refunded: number; refund: RefundOutcome }
  | { kind: 'failed' }
  | { kind: 'processing' };

/** Quyết định thông báo của trang kết quả thanh toán */
export function resolvePaymentResult(status: PaymentStatusResponse): PaymentResult {
  const succeeded = status.ThanhToan.filter((payment) => payment.TrangThai === PAYMENT_STATUS.SUCCESS);
  // Đơn đã hoàn tất vẫn là đơn đã thanh toán
  if (status.TrangThaiDatPhong === BOOKING_STATUS.CONFIRMED || (status.TrangThaiDatPhong === BOOKING_STATUS.COMPLETED && succeeded.length > 0)) return { kind: 'confirmed' };
  if (status.TrangThaiDatPhong === BOOKING_STATUS.CANCELLED && succeeded.length > 0) {
    const paid = succeeded.reduce((sum, payment) => sum + payment.SoTien, 0);
    const refunds = succeeded.flatMap((payment) => payment.HoanTien);
    const refunded = refunds.filter((refund) => refund.TrangThai === REFUND_STATUS.SUCCESS).reduce((sum, refund) => sum + refund.SoTienHoan, 0);

    let refund: RefundOutcome = 'none';
    if (refunded >= paid) refund = 'refunded';
    else if (refunds.some((item) => item.TrangThai === REFUND_STATUS.FAILED)) refund = 'failed';
    else if (refunds.some((item) => item.TrangThai === REFUND_STATUS.PENDING)) refund = 'pending';
    else if (refunded > 0) refund = 'refunded';
    return { kind: 'cancelled-paid', paid, refunded, refund };
  }

  if (status.ThanhToan[0]?.TrangThai === PAYMENT_STATUS.FAILED) return { kind: 'failed' };
  return { kind: 'processing' };
}
