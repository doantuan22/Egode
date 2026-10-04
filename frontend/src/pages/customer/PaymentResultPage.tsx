import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCreateVnpayPayment, usePaymentStatus } from '../../features/payments/hooks';
import { formatCurrencyVND } from '../../lib/utils';
import { CustomerCenterNavigation } from '../../components/layouts/CustomerCenterNavigation';
import { resolvePaymentResult, type PaymentResult } from '../../features/payments/result';
import { BOOKING_STATUS } from '../../features/bookings/status';
import { ApiError } from '../../services/apiClient';
import { PageSpinner } from '../../components/common/PageSpinner';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { ResultBanner } from '../../components/bookings/ResultBanner';

function refundMessage(result: Extract<PaymentResult, { kind: 'cancelled-paid' }>, confirmationCode: string): string {
  switch (result.refund) {
    case 'refunded':
      return result.refunded >= result.paid
        ? `Khoản thanh toán ${formatCurrencyVND(result.paid)} đã được hoàn lại đầy đủ.`
        : `Đã hoàn ${formatCurrencyVND(result.refunded)} trong số ${formatCurrencyVND(result.paid)} đã thanh toán.`;
    case 'pending':
      return 'Yêu cầu hoàn tiền đang được xử lý. Vui lòng theo dõi trạng thái hoàn tiền trong chi tiết đơn.';
    case 'failed':
      return 'Hoàn tiền chưa thành công. Bạn có thể thử lại trong chi tiết đơn hoặc liên hệ hỗ trợ.';
    default:
      return `Chúng tôi chưa ghi nhận yêu cầu hoàn tiền cho khoản thanh toán này. Vui lòng liên hệ hỗ trợ kèm mã đơn ${confirmationCode}.`;
  }
}

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const bookingId = Number(searchParams.get('bookingId'));
  const hintStatus = searchParams.get('status');

  const hasBookingId = Number.isFinite(bookingId) && bookingId > 0;
  const statusQuery = usePaymentStatus(bookingId, { enabled: hasBookingId });
  const booking = statusQuery.data;
  const latestPayment = booking?.ThanhToan[0];
  const result = booking ? resolvePaymentResult(booking) : null;
  const isConfirmed = result?.kind === 'confirmed';
  // Confirmed without a single payment row: the booking had nothing to pay (total 0).
  const isFreeBooking = isConfirmed && booking?.ThanhToan.length === 0;
  const isFailed = result?.kind === 'failed';
  // A failed attempt can be retried only while the booking still holds the rooms.
  const canRetryPayment = isFailed && booking?.TrangThaiDatPhong === BOOKING_STATUS.PENDING_PAYMENT;
  const payMutation = useCreateVnpayPayment(hasBookingId ? bookingId : 0);
  const retryPayment = () => payMutation.mutate(undefined, { onSuccess: (payment) => { window.location.href = payment.paymentUrl; } });

  const bookingLink = hasBookingId ? `/bookings/${bookingId}` : null;
  const linkButton = (to: string, label: string, variant: 'primary' | 'secondary' | 'danger' = 'primary') => (
    <Button asChild variant={variant} size="lg" className="sm:flex-1"><Link to={to}>{label}</Link></Button>
  );

  let outcome: ReactNode;
  if (!hasBookingId) {
    // The gateway redirect carried no booking (unknown callback / invalid signature): nothing to look up, and no outcome to claim.
    outcome = (
      <ResultBanner
        tone="error"
        title="Chưa xác định được kết quả thanh toán"
        description='Chúng tôi không nhận được thông tin đơn đặt phòng từ cổng thanh toán nên chưa thể xác nhận giao dịch. Nếu tài khoản của bạn đã bị trừ tiền, hãy kiểm tra trong "Đặt phòng của tôi" hoặc gửi yêu cầu hỗ trợ kèm thời điểm thanh toán.'
        actions={<>{linkButton('/bookings', 'Xem đặt phòng của tôi')}{linkButton('/support', 'Liên hệ hỗ trợ', 'secondary')}</>}
      />
    );
  } else if (statusQuery.isLoading) {
    outcome = <PageSpinner />;
  } else if (statusQuery.isError && !booking) {
    outcome = (
      <ResultBanner
        tone="error"
        title="Không thể tải kết quả thanh toán"
        actions={
          <>
            <Button type="button" size="lg" className="sm:flex-1" onClick={() => statusQuery.refetch()}>Thử lại</Button>
            {linkButton(`/bookings/${bookingId}`, 'Xem đơn đặt phòng', 'secondary')}
          </>
        }
      >
        <p role="alert" className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-muted">
          {statusQuery.error instanceof ApiError ? statusQuery.error.message : 'Đã có lỗi khi lấy trạng thái đơn đặt phòng. Vui lòng thử lại.'}
        </p>
      </ResultBanner>
    );
  } else if (result?.kind === 'cancelled-paid' && booking) {
    outcome = (
      <ResultBanner
        tone="error"
        title="Đơn đặt phòng không được xác nhận"
        description="Đơn đã hết hạn hoặc đã bị hủy trước khi thanh toán hoàn tất, nên không được xác nhận."
        actions={<>{linkButton(`/bookings/${bookingId}`, 'Xem chi tiết đơn')}{linkButton('/support', 'Liên hệ hỗ trợ', 'secondary')}</>}
      >
        <p className="mx-auto mb-6 max-w-md text-sm font-semibold leading-relaxed text-heading">{refundMessage(result, booking.MaXacNhanDatPhong)}</p>
      </ResultBanner>
    );
  } else if (isConfirmed) {
    outcome = (
      <ResultBanner
        tone="success"
        title={isFreeBooking ? 'Đặt phòng thành công!' : 'Thanh toán thành công!'}
        description={isFreeBooking
          ? 'Cảm ơn bạn đã lựa chọn Egode. Đơn có tổng thanh toán 0 đ nên được xác nhận ngay, không cần thanh toán.'
          : 'Cảm ơn bạn đã lựa chọn Egode. Đặt phòng của bạn đã được xác nhận.'}
        actions={<>{bookingLink && linkButton(bookingLink, 'Xem đơn đặt phòng')}{linkButton('/', 'Về trang chủ', 'secondary')}</>}
      >
        {booking && (
          <>
            <div className="mb-8 inline-block rounded-xl border border-dashed border-primary/40 bg-primary-50 px-5 py-2 text-xl font-bold text-primary">
              {booking.MaXacNhanDatPhong}
            </div>
            <div className="mb-8 rounded-xl border border-border bg-surface-secondary p-5 text-left">
              <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
                <h2 className="text-base font-semibold text-heading">{isFreeBooking ? 'Tổng quan đơn' : 'Tổng quan giao dịch'}</h2>
                {isFreeBooking ? <StatusBadge domain="booking" status={booking.TrangThaiDatPhong} /> : <StatusBadge domain="payment" status="Thành công" />}
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-muted">Số tiền thanh toán</span>
                <span className="text-xl font-bold text-primary">{formatCurrencyVND(latestPayment?.SoTien ?? 0)}</span>
              </div>
              {isFreeBooking && <p className="mt-3 text-xs text-muted">Không phát sinh giao dịch thanh toán cho đơn này.</p>}
            </div>
          </>
        )}
      </ResultBanner>
    );
  } else if (isFailed) {
    outcome = (
      <ResultBanner
        tone="error"
        title="Thanh toán không thành công"
        description="Giao dịch qua thanh toán trực tuyến không thành công. Vui lòng kiểm tra lại số dư tài khoản hoặc thử lại phương thức thanh toán khác."
        actions={
          <>
            {canRetryPayment && (
              <Button type="button" size="lg" className="sm:flex-1" onClick={retryPayment} loading={payMutation.isPending}>
                {payMutation.isPending ? 'Đang chuyển đến cổng thanh toán...' : 'Thử thanh toán lại'}
              </Button>
            )}
            {bookingLink && linkButton(bookingLink, 'Về chi tiết đơn', canRetryPayment ? 'secondary' : 'danger')}
          </>
        }
      >
        {payMutation.isError && (
          <p role="alert" className="mb-4 rounded-lg bg-danger-light p-3 text-sm text-danger-ink">
            {payMutation.error instanceof ApiError ? payMutation.error.message : 'Không thể khởi tạo thanh toán'}
          </p>
        )}
      </ResultBanner>
    );
  } else {
    outcome = (
      <ResultBanner
        tone="pending"
        title="Đang xử lý kết quả..."
        description={hintStatus === 'success'
          ? 'VNPAY báo thành công, đang chờ xác nhận cuối cùng từ hệ thống.'
          : 'Vui lòng kiểm tra lại trạng thái đặt phòng trong ít phút.'}
        actions={bookingLink ? linkButton(bookingLink, 'Xem đơn đặt phòng') : undefined}
      />
    );
  }

  return (
    <div className="bg-surface-secondary text-ink min-h-screen flex flex-col font-sans antialiased">
      <div className="page-container max-w-[800px] pt-8"><CustomerCenterNavigation /></div>
      <div className="page-container max-w-[800px] py-12 md:py-16 flex-grow flex flex-col items-center justify-center">
        {outcome}
      </div>
    </div>
  );
}
