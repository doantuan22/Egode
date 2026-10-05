import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useBookingDetail, useCancelBooking } from '../../features/bookings/hooks';
import { hoursBeforeCheckIn, selectRefundPercentPreview, computeRefundAmountPreview } from '../../features/bookings/refund-preview';
import { useCreateVnpayPayment, useRetryRefund } from '../../features/payments/hooks';
import { ReviewSection } from '../../components/reviews/ReviewSection';
import { PaymentHoldNotice } from '../../components/bookings/PaymentHoldNotice';
import { BookingSummary } from '../../components/bookings/BookingSummary';
import { BookingActions } from '../../components/bookings/BookingActions';
import { Icon } from '../../components/common/Icon';
import { cn, formatDateVi } from '../../lib/utils';
import { ApiError } from '../../services/apiClient';
import { CustomerCenterNavigation } from '../../components/layouts/CustomerCenterNavigation';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { BOOKING_STATUS, CANCELLABLE_BOOKING_STATUSES } from '../../features/bookings/status';
import { PageSpinner } from '../../components/common/PageSpinner';

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const bookingId = Number(id);
  const location = useLocation();
  const justBooked = Boolean((location.state as { justBooked?: boolean } | null)?.justBooked);

  const bookingQuery = useBookingDetail(bookingId);
  const payMutation = useCreateVnpayPayment(bookingId);
  const cancelMutation = useCancelBooking(bookingId);
  const retryRefundMutation = useRetryRefund(bookingId);

  // Linked from the booking list ("Đánh giá"): the review section only exists after the booking has loaded.
  const bookingLoaded = Boolean(bookingQuery.data);
  useEffect(() => {
    if (bookingLoaded && location.hash === '#danh-gia') document.getElementById('danh-gia')?.scrollIntoView();
  }, [bookingLoaded, location.hash]);

  if (bookingQuery.isLoading) {
    return <PageSpinner />;
  }

  if (bookingQuery.isError || !bookingQuery.data) {
    return (
      <div role="alert" className="mx-auto max-w-md mt-8 rounded-lg bg-danger-light px-4 py-3 text-center text-sm text-danger-ink">
        {bookingQuery.error instanceof ApiError ? bookingQuery.error.message : 'Không tìm thấy đặt phòng'}
      </div>
    );
  }

  const booking = bookingQuery.data;
  const canCancel = CANCELLABLE_BOOKING_STATUSES.includes(booking.TrangThai);
  const successfulPaid = booking.ThanhToan.filter((p) => p.TrangThai === 'Thành công').reduce((sum, p) => sum + p.SoTien, 0);
  const previewHours = hoursBeforeCheckIn(booking.ThoiDiemNhanPhong);
  const previewPercent = selectRefundPercentPreview(booking.ChinhSachHuy.ChiTiet, previewHours);
  const previewAmount = computeRefundAmountPreview(successfulPaid, previewPercent);

  const startPayment = () => {
    payMutation.mutate(undefined, {
      onSuccess: (result) => {
        window.location.href = result.paymentUrl;
      },
    });
  };

  const confirmCancel = (note: string | undefined, onDone: () => void) => {
    cancelMutation.mutate({ ghiChu: note }, { onSuccess: onDone });
  };

  return (
    <div className="page-container booking-detail-page flex flex-col gap-6">
      <CustomerCenterNavigation />
      <Link to="/bookings" className="breadcrumb w-fit">
        <Icon name="arrow-left" />
        <span>Quay lại danh sách đặt phòng</span>
      </Link>

      {booking.TrangThai === BOOKING_STATUS.PENDING_PAYMENT && booking.HanThanhToan && booking.SoGiayConLai !== null && (
        <PaymentHoldNotice
          deadline={booking.HanThanhToan}
          secondsLeft={booking.SoGiayConLai}
          startedAt={bookingQuery.dataUpdatedAt}
          justBooked={justBooked}
          onExpire={() => { void bookingQuery.refetch(); }}
        />
      )}

      <div className="card p-6 flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-ink flex items-center gap-3 flex-wrap">
            Chi tiết đặt phòng <span className="text-primary">#{booking.MaXacNhanDatPhong}</span>
          </h1>
          <p className="text-[13px] text-muted mt-1">Trạng thái hiện tại: {booking.TrangThai}</p>
        </div>
        <StatusBadge domain="booking" status={booking.TrangThai} />
      </div>

      <div className="two-col-layout">
        
        {/* Left Column */}
        <div className="flex flex-col gap-6">
          
          <div className="card card-body">
            <div className="flex gap-5 mb-5 flex-wrap">
              {booking.AnhDaiDien && (
                <img
                  src={booking.AnhDaiDien}
                  alt=""
                  decoding="async"
                  className="booking-detail-page__hotel-image"
                />
              )}
              <div>
                <h2 className="text-lg font-bold text-ink mb-1">{booking.TenKhachSan}</h2>
                <p className="text-[13px] text-muted flex items-center gap-1.5 mb-2">
                  <i className="ph ph-map-pin" aria-hidden="true"></i>
                  {booking.DiaChiChiTiet}
                </p>
                {booking.GhiChu && <p className="text-[13px] text-muted mb-2">Ghi chú: {booking.GhiChu}</p>}
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-2">
                  <Link to={`/hotels/${booking.MaKhachSan}`} className="inline-flex items-center gap-1 text-[13px] text-primary hover:underline">Xem thông tin khách sạn <i className="ph ph-arrow-right" aria-hidden="true"></i></Link>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${booking.TenKhachSan}, ${booking.DiaChiChiTiet}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[13px] text-primary hover:underline"
                  >
                    Xem trên bản đồ <i className="ph ph-map-trifold" aria-hidden="true"></i>
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 bg-surface-secondary border border-border rounded-lg p-4 gap-4">
              <div>
                <p className="block text-[12px] text-muted mb-1">Nhận phòng</p>
                <span className="text-[15px] font-semibold text-heading">{formatDateVi(booking.NgayNhanPhong)}</span>
                <span className="block text-[12px] text-muted">Từ {booking.GioNhanPhong}</span>
              </div>
              <div>
                <p className="block text-[12px] text-muted mb-1">Trả phòng</p>
                <span className="text-[15px] font-semibold text-heading">{formatDateVi(booking.NgayTraPhong)}</span>
                <span className="block text-[12px] text-muted">Trước {booking.GioTraPhong}</span>
              </div>
            </div>
          </div>

          <div className="card card-body">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-border">
              <span className="text-base font-bold text-heading">Thông tin phòng nghỉ</span>
            </div>

            {booking.ChiTietPhong.map((line, i) => (
              <div key={line.MaLoaiPhong} className={cn("flex justify-between items-center pb-4", i !== booking.ChiTietPhong.length - 1 && "border-b border-dashed border-border mb-4")}>
                <div>
                  <div className="text-[15px] font-semibold text-heading mb-1">{line.TenLoaiPhong}</div>
                  <div className="text-[13px] text-muted">Số lượng: {line.SoLuong} phòng</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card card-body">
            <div className="text-base font-bold text-heading mb-5 pb-3 border-b border-border">Chính sách hủy đặt phòng</div>
            <div className="flex items-center gap-2 mb-4">
              <i className="ph-fill ph-shield-check text-primary text-xl"></i>
              <span className="font-semibold text-ink text-sm">{booking.ChinhSachHuy.TenChinhSach}</span>
            </div>
            <div className="flex flex-col gap-3.5 relative">
              {booking.ChinhSachHuy.ChiTiet.map((tier, i) => (
                <div key={i} className="flex gap-3.5 relative">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 z-10 bg-primary-50 text-primary border border-primary-100">
                    {i + 1}
                  </div>
                  <div>
                    <h5 className="text-[14px] font-semibold text-heading">Trước {tier.SoGioTruocNhanPhong} giờ</h5>
                    <p className="text-[13px] text-muted mt-0.5">Hoàn tiền {tier.TyLeHoanTien}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column */}
        <aside className="flex flex-col gap-5">
          <BookingSummary
            booking={booking}
            onRetryRefund={(refundId) => retryRefundMutation.mutate(refundId)}
            isRetryingRefund={retryRefundMutation.isPending}
            retryRefundError={retryRefundMutation.isError ? (retryRefundMutation.error instanceof ApiError ? retryRefundMutation.error.message : 'Không thể thử lại hoàn tiền') : null}
          />
          <BookingActions
            canPay={booking.TrangThai === BOOKING_STATUS.PENDING_PAYMENT}
            canCancel={canCancel}
            onPay={startPayment}
            isPaying={payMutation.isPending}
            payError={payMutation.isError ? payMutation.error : null}
            onCancel={confirmCancel}
            isCancelling={cancelMutation.isPending}
            cancelError={cancelMutation.isError ? cancelMutation.error : null}
            refundPreview={{ paid: successfulPaid, percent: previewPercent, amount: previewAmount }}
          />
        </aside>

      </div>

      <ReviewSection bookingId={booking.MaDatPhong} bookingStatus={booking.TrangThai} />

    </div>
  );
}
