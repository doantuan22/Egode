import { REFUND_STATUS } from '../payments/result';
import type { BookingDetail } from './types';

export interface RefundSummary {
  /** refunded: money returned · unfinished: a refund exists but is not completed · none: nothing to refund */
  kind: 'refunded' | 'unfinished' | 'none';
  /** Sum of the refunds that completed. */
  amount: number;
  /** Payment method the money goes back to (the original one). */
  method: string | null;
}

/** What a just-cancelled, previously paid booking got back, from the booking detail the cancel call returned. */
export function summarizeRefund(booking: Pick<BookingDetail, 'ThanhToan'>): RefundSummary {
  const paid = booking.ThanhToan.filter((payment) => payment.TrangThai === 'Thành công');
  const refunds = paid.flatMap((payment) => payment.HoanTien);
  const amount = refunds.filter((refund) => refund.TrangThai === REFUND_STATUS.SUCCESS).reduce((sum, refund) => sum + refund.SoTienHoan, 0);
  const method = paid[0]?.PhuongThucThanhToan ?? null;
  if (refunds.some((refund) => refund.TrangThai !== REFUND_STATUS.SUCCESS)) return { kind: 'unfinished', amount, method };
  if (amount > 0) return { kind: 'refunded', amount, method };
  return { kind: 'none', amount: 0, method };
}
