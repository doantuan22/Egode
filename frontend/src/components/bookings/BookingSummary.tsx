import type { BookingDetail } from '../../features/bookings/types';
import { cn, formatCurrencyVND, formatDateTimeVi } from '../../lib/utils';
import { Button } from '../common/Button';
import { Card } from '../common/Card';

interface BookingSummaryProps {
  booking: BookingDetail;
  /** Retries a refund that did not succeed; gets the refund id. */
  onRetryRefund: (refundId: number) => void;
}

/** The money side of a booking: room total, promotion, the amount to pay, and every payment with its refunds. */
export function BookingSummary({ booking, onRetryRefund }: BookingSummaryProps) {
  return (
    <Card padded={false} className="card-body">
      <h2 className="text-base font-bold text-heading mb-5 pb-3 border-b border-border">Chi tiết thanh toán</h2>

      <div className="flex justify-between text-[14px] text-muted mb-3">
        <span>Tổng tiền phòng</span>
        <span>{formatCurrencyVND(booking.TongTienPhong)}</span>
      </div>
      {booking.SoTienGiam > 0 && (
        <div className="flex justify-between text-[14px] text-success-ink mb-3">
          <span>Khuyến mãi {booking.KhuyenMai?.MaCode}</span>
          <span>− {formatCurrencyVND(booking.SoTienGiam)}</span>
        </div>
      )}

      <div className="flex justify-between items-center pt-3.5 mt-3.5 border-t border-border">
        <span className="text-[15px] font-semibold text-heading">Tổng thanh toán</span>
        <span className="text-[20px] font-bold text-primary">{formatCurrencyVND(booking.TongTienThanhToan)}</span>
      </div>

      <div className="mt-4 pt-3.5 border-t border-dashed border-border text-[13px] text-muted flex flex-col gap-1.5">
        {booking.ThanhToan.length === 0 ? (
          <div>{booking.TongTienThanhToan === 0 ? 'Đơn 0 đ — không phát sinh giao dịch thanh toán.' : 'Chưa có giao dịch thanh toán.'}</div>
        ) : (
          booking.ThanhToan.map((payment) => (
            <div key={payment.MaThanhToan} className="bg-surface-secondary p-2 rounded border border-surface-tertiary mt-2">
              <div>Phương thức: <strong>{payment.PhuongThucThanhToan}</strong></div>
              <div>Trạng thái: <strong className={cn(payment.TrangThai === 'Thành công' && 'text-success-ink')}>{payment.TrangThai}</strong></div>
              <div>Số tiền: <strong>{formatCurrencyVND(payment.SoTien)}</strong></div>
              <div className="text-[11px] mt-1">{formatDateTimeVi(payment.ThoiGianGiaoDich)}</div>

              {payment.HoanTien.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border">
                  {payment.HoanTien.map((refund) => (
                    <div key={refund.MaHoanTien} className="flex flex-wrap items-center gap-2 text-warning-ink">
                      <span><strong>Hoàn tiền:</strong> {formatCurrencyVND(refund.SoTienHoan)} ({refund.TrangThai})</span>
                      {refund.TrangThai !== 'Thành công' && (
                        <Button type="button" variant="outline" size="sm" onClick={() => onRetryRefund(refund.MaHoanTien)}>Thử lại</Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
