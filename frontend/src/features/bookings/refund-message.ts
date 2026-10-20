import { REFUND_STATUS } from '../payments/result';
import type { BookingDetail } from './types';

export interface RefundSummary {
  /** Trạng thái hoàn tiền: đã hoàn, chưa xong hoặc không có */
  kind: 'refunded' | 'unfinished' | 'none';
  /** Tổng số tiền đã hoàn xong */
  amount: number;
  /** Phương thức nhận lại tiền */
  method: string | null;
}

/** Kết quả hoàn tiền của đơn vừa hủy */
export function summarizeRefund(booking: Pick<BookingDetail, 'ThanhToan'>): RefundSummary {
  const paid = booking.ThanhToan.filter((payment) => payment.TrangThai === 'Thành công');
  const refunds = paid.flatMap((payment) => payment.HoanTien);
  const amount = refunds.filter((refund) => refund.TrangThai === REFUND_STATUS.SUCCESS).reduce((sum, refund) => sum + refund.SoTienHoan, 0);
  const method = paid[0]?.PhuongThucThanhToan ?? null;
  if (refunds.some((refund) => refund.TrangThai !== REFUND_STATUS.SUCCESS)) return { kind: 'unfinished', amount, method };
  if (amount > 0) return { kind: 'refunded', amount, method };
  return { kind: 'none', amount: 0, method };
}
