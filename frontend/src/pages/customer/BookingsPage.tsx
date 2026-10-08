import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMyBookings } from '../../features/bookings/hooks';
import { CustomerCenterNavigation } from '../../components/layouts/CustomerCenterNavigation';
import { formatCurrencyVND, formatDateVi } from '../../lib/utils';
import { ApiError } from '../../services/apiClient';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { BOOKING_TABS, canReviewBooking, matchesBookingTab, type BookingTab } from '../../features/bookings/status';
import { FilterChip } from '../../components/common/FilterChip';
import { PageSpinner } from '../../components/common/PageSpinner';

export default function BookingsPage() {
  const bookingsQuery = useMyBookings();
  const [activeTab, setActiveTab] = useState<BookingTab>('all');

  const filteredBookings = bookingsQuery.data?.filter((b) => matchesBookingTab(b.TrangThai, activeTab));

  return (
    <div className="page-container booking-history-page">
      <CustomerCenterNavigation />
      {/* The tab above already names the page, so the heading is for screen readers only. */}
      <h1 className="sr-only">Đơn đặt phòng của tôi</h1>

      <div role="group" aria-label="Lọc đặt phòng theo trạng thái" className="pill-tabs mb-5">
        {BOOKING_TABS.map((tab) => (<FilterChip key={tab.key} pressed={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}>{tab.label}</FilterChip>))}
      </div>

      {bookingsQuery.isLoading ? (
        <PageSpinner />
      ) : bookingsQuery.isError ? (
        <div role="alert" className="rounded-lg bg-danger-light px-4 py-3 text-sm text-danger-ink">
          {bookingsQuery.error instanceof ApiError ? bookingsQuery.error.message : 'Không thể tải danh sách đặt phòng'}
        </div>
      ) : !bookingsQuery.data || bookingsQuery.data.length === 0 ? (
        <div className="empty-state">
          <i className="ph-duotone ph-suitcase"></i>
          <div className="empty-state__title">Không có đặt phòng nào</div>
          <div className="empty-state__desc">Bạn chưa thực hiện đơn đặt phòng nào. Hãy khám phá danh sách khách sạn và lên kế hoạch cho chuyến đi tiếp theo!</div>
          <Link to="/hotels" className="btn btn-primary mt-4">Tìm kiếm khách sạn</Link>
        </div>
      ) : filteredBookings?.length === 0 ? (
         <div className="empty-state">
           <i className="ph-duotone ph-suitcase"></i>
           <div className="empty-state__title">Không có đặt phòng nào</div>
           <div className="empty-state__desc">Không tìm thấy đơn đặt phòng nào phù hợp với bộ lọc bạn đã chọn.</div>
         </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredBookings?.map((b) => (
            <div key={b.MaDatPhong} className="card card-hover flex flex-col sm:flex-row items-stretch sm:items-center p-5 gap-5">
              {b.AnhDaiDien && (
                <img
                  src={b.AnhDaiDien}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="booking-history-page__hotel-image"
                />
              )}
              <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <span className="text-[13px] font-semibold text-primary">Mã đơn: {b.MaXacNhanDatPhong}</span>
                  <StatusBadge domain="booking" status={b.TrangThai} />
                </div>
                <h3 className="text-base font-semibold text-heading truncate">{b.TenKhachSan}</h3>
                <p className="text-[13px] text-muted truncate">{b.DiaChiChiTiet}</p>
                <div className="text-[13px] text-muted flex gap-x-4 gap-y-1 flex-wrap mt-1">
                  <span>Nhận: <strong className="text-heading">{formatDateVi(b.NgayNhanPhong)}</strong></span>
                  <span className="hidden sm:inline">•</span>
                  <span>Trả: <strong className="text-heading">{formatDateVi(b.NgayTraPhong)}</strong></span>
                </div>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-3 min-w-[140px]">
                <div className="text-lg font-bold text-primary">{formatCurrencyVND(b.TongTienThanhToan)}</div>
                <div className="flex gap-2">
                  <Link to={`/bookings/${b.MaDatPhong}`} className="btn btn-outline btn-sm">Chi tiết</Link>
                  {canReviewBooking(b.TrangThai) && (
                    <Link to={`/bookings/${b.MaDatPhong}#danh-gia`} className="btn btn-primary btn-sm">Đánh giá</Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
