import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useMyHotels, useOwnerBookings } from '../../features/owner/hooks';
import { ApiError } from '../../services/apiClient';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { PageSpinner } from '../../components/common/PageSpinner';
import { OwnerScopeGate } from '../../components/owner/OwnerScopeGate';
import { useScopedHotels } from '../../components/owner/useScopedHotels';
import { useOwnerHotelAnalytics } from '../../features/analytics/hooks';
import { formatCurrencyVND } from '../../lib/utils';
import { businessToday } from '../../lib/stayDates';
import { BOOKING_STATUS } from '../../features/bookings/status';
import { changeVersusPrevious, computeKpis, lastDaysRanges } from '../../features/analytics/kpi';
import type { OwnerAnalytics } from '../../features/analytics/types';
import { KpiCard } from '../../components/owner/KpiCard';
import { Card } from '../../components/common/Card';
import { FilterChip } from '../../components/common/FilterChip';

/** KPI period: the last N days against the N days before them. */
const KPI_PERIOD_DAYS = 30;

export default function OwnerDashboardPage({ mode }: { mode: 'overview' | 'hotels' }) {
  const isOverview = mode === 'overview';
  const hotelsQuery = useMyHotels();
  const scope = useScopedHotels();
  // Owner analytics are defined per hotel, so multi-property owners choose a
  // scope instead of receiving an incorrect sum assembled in the browser.
  const analyticsHotelId = isOverview ? (scope.hotelId ?? 0) : 0;
  const ranges = useMemo(() => lastDaysRanges(KPI_PERIOD_DAYS), []);
  const currentAnalytics = useOwnerHotelAnalytics(analyticsHotelId, ranges.current);
  const previousAnalytics = useOwnerHotelAnalytics(analyticsHotelId, ranges.previous);
  const today = businessToday();
  const checkInsToday = useOwnerBookings(analyticsHotelId, { page: 1, limit: 1, from: today, to: today, trangThai: BOOKING_STATUS.CONFIRMED });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const hotels = hotelsQuery.data || [];
  const activeCount = hotels.filter(h => h.TrangThai === 'Hoạt động').length;
  const pendingCount = hotels.filter(h => h.TrangThai === 'Chờ duyệt').length;
  const suspendedCount = hotels.filter(h => h.TrangThai === 'Đình chỉ').length;
  const rejectedCount = hotels.filter(h => h.TrangThai === 'Từ chối').length;
  const inactiveCount = hotels.filter(h => h.TrangThai === 'Ngừng hoạt động').length;
  const visibleHotels = useMemo(() => (hotelsQuery.data ?? []).filter((hotel) => {
    const search = searchTerm.trim().toLocaleLowerCase('vi');
    const matchesSearch = !search || `${hotel.TenKhachSan} ${hotel.DiaChiChiTiet} ${hotel.DIA_PHUONG.TenThanhPho}`.toLocaleLowerCase('vi').includes(search);
    const matchesStatus = statusFilter === 'all' || hotel.TrangThai === statusFilter;
    return matchesSearch && matchesStatus;
  }), [hotelsQuery.data, searchTerm, statusFilter]);

  return (
    <div className="owner-dashboard space-y-6">
      
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>{isOverview ? 'Tổng quan' : 'Khách sạn của tôi'}</h1>
          <p className="page-header__desc">{isOverview ? 'Tổng quan tình trạng hoạt động và các cơ sở lưu trú của bạn.' : 'Tìm kiếm và quản lý hồ sơ, hình ảnh, tiện nghi và trạng thái khách sạn.'}</p>
        </div>
        <Link to="/owner/hotels/new" className="btn btn-primary">
          <i className="ph ph-plus"></i> Thêm khách sạn mới
        </Link>
      </div>

      {hotelsQuery.isLoading ? (
        <PageSpinner />
      ) : hotelsQuery.isError ? (
        <div role="alert" className="rounded-lg bg-danger-light px-4 py-3 text-sm text-danger-ink border border-danger/30">
          {hotelsQuery.error instanceof ApiError ? hotelsQuery.error.message : 'Không thể tải danh sách khách sạn'}
        </div>
      ) : hotels.length === 0 ? (
        <div className="rounded-2xl border border-border bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary text-2xl mb-4">
            <i className="ph-duotone ph-buildings"></i>
          </div>
          <h2 className="text-lg font-semibold text-heading mb-2">Bạn chưa có khách sạn nào</h2>
          <p className="mx-auto max-w-md text-sm text-muted mb-5">
            Đăng ký khách sạn đầu tiên để bắt đầu kinh doanh trên nền tảng Egode.
          </p>
          <Link to="/owner/hotels/new" className="btn btn-primary">
            <i className="ph ph-plus"></i> Đăng ký khách sạn
          </Link>
        </div>
      ) : (
        <>
          {/* Overview uses only the real property states returned by the API. */}
          {isOverview && <div className="owner-status-summary grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4 flex justify-between items-center">
              <div>
                <span className="text-[13px] text-muted block mb-1">Đang hoạt động</span>
                <strong className="text-[20px] text-heading font-bold">{activeCount} cơ sở</strong>
              </div>
              <span className="owner-status-dot owner-status-dot--success" aria-hidden="true"></span>
            </div>
            <div className="card p-4 flex justify-between items-center">
              <div>
                <span className="text-[13px] text-muted block mb-1">Chờ hệ thống duyệt</span>
                <strong className="text-[20px] text-heading font-bold">{pendingCount} cơ sở</strong>
              </div>
              <span className="owner-status-dot owner-status-dot--warning" aria-hidden="true"></span>
            </div>
            <div className="card p-4 flex justify-between items-center">
              <div>
                <span className="text-[13px] text-muted block mb-1">Đình chỉ / Tạm ngưng</span>
                <strong className="text-[20px] text-heading font-bold">{suspendedCount} cơ sở</strong>
              </div>
              <span className="owner-status-dot owner-status-dot--danger" aria-hidden="true"></span>
            </div>
          </div>}

          {isOverview && (
            <section className="space-y-4" aria-labelledby="owner-overview-performance">
              <div className="flex flex-col gap-1">
                <h2 id="owner-overview-performance" className="text-base font-semibold text-heading">Hiệu quả vận hành</h2>
                <p className="text-sm text-muted">{KPI_PERIOD_DAYS} ngày gần nhất của khách sạn đang chọn, so với {KPI_PERIOD_DAYS} ngày liền trước.</p>
              </div>
              <OwnerScopeGate scope={scope} prompt="Chọn khách sạn để xem số liệu vận hành." />
              {scope.hotelId && (
                <>
                  <TodayPanel
                    checkIns={checkInsToday.data?.pagination.total}
                    isError={checkInsToday.isError}
                    to={`/owner/bookings?${new URLSearchParams({ hotelId: String(scope.hotelId), from: today, to: today, trangThai: BOOKING_STATUS.CONFIRMED })}`}
                  />
                  {currentAnalytics.isLoading ? <PageSpinner /> : currentAnalytics.isError || !currentAnalytics.data ? (
                    <div role="alert" className="rounded-lg border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
                      {currentAnalytics.error instanceof ApiError ? currentAnalytics.error.message : 'Không thể tải số liệu vận hành'}
                    </div>
                  ) : (
                    <KpiGrid current={currentAnalytics.data} previous={previousAnalytics.data} />
                  )}
                </>
              )}
            </section>
          )}

          {!isOverview && <div className="owner-dashboard__filters flex justify-between items-center gap-4 flex-wrap">
            <div className="relative flex-1 max-w-[420px] min-w-[220px]">
              <i className="ph ph-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted text-lg"></i>
              <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="input !pl-10" placeholder="Tìm theo tên khách sạn, địa chỉ..." aria-label="Tìm khách sạn theo tên hoặc địa chỉ" />
            </div>

            <div className="flex gap-2 flex-wrap" role="group" aria-label="Lọc theo trạng thái khách sạn">
              <FilterChip pressed={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>Tất cả ({hotels.length})</FilterChip>
              <FilterChip pressed={statusFilter === 'Hoạt động'} onClick={() => setStatusFilter('Hoạt động')}>Hoạt động ({activeCount})</FilterChip>
              <FilterChip pressed={statusFilter === 'Chờ duyệt'} onClick={() => setStatusFilter('Chờ duyệt')}>Chờ duyệt ({pendingCount})</FilterChip>
              {suspendedCount > 0 && <FilterChip pressed={statusFilter === 'Đình chỉ'} onClick={() => setStatusFilter('Đình chỉ')}>Đình chỉ ({suspendedCount})</FilterChip>}
              {rejectedCount > 0 && <FilterChip pressed={statusFilter === 'Từ chối'} onClick={() => setStatusFilter('Từ chối')}>Từ chối ({rejectedCount})</FilterChip>}
              {inactiveCount > 0 && <FilterChip pressed={statusFilter === 'Ngừng hoạt động'} onClick={() => setStatusFilter('Ngừng hoạt động')}>Ngừng hoạt động ({inactiveCount})</FilterChip>}
            </div>
          </div>}

          {isOverview && <h2 className="text-base font-semibold text-heading">Cơ sở lưu trú của bạn</h2>}
          {/* Property identity and current state stay together as the owner context. */}
          <div className="owner-hotel-list flex flex-col">
            {visibleHotels.map((hotel) => (
              <article key={hotel.MaKhachSan} className="owner-hotel-list__item flex flex-col md:flex-row gap-4 items-stretch md:items-center">
                
                <div className="relative w-full md:w-[156px] h-[118px] rounded-lg overflow-hidden flex-shrink-0 bg-surface-tertiary flex items-center justify-center">
                  {hotel.HINH_ANH_KHACH_SAN[0] ? (
                    <img src={hotel.HINH_ANH_KHACH_SAN[0].URL} alt={hotel.TenKhachSan} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  ) : (
                    <span className="owner-hotel-image-fallback">Ảnh khách sạn</span>
                  )}
                </div>

                <div className="flex-1 flex flex-col gap-2.5 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-[17px] font-bold text-heading">{hotel.TenKhachSan}</h3>
                    <span className="text-warning text-[13px] tracking-widest">
                      {'★'.repeat(hotel.HangSao)}{'☆'.repeat(5 - hotel.HangSao)}
                    </span>
                    <StatusBadge domain="hotel" status={hotel.TrangThai} />
                  </div>

                  <div className="flex items-center gap-1.5 text-[13px] text-muted">
                    <i className="ph ph-map-pin"></i>
                    <span>{hotel.DIA_PHUONG.TenThanhPho}</span>
                  </div>

                  <div className="flex gap-7 flex-wrap pt-2.5 mt-1 border-t border-dashed border-border">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[12px] text-muted">Phòng</span>
                      <strong className="text-[14px] font-semibold text-heading">{hotel._count?.LOAI_PHONG ?? 0} loại</strong>
                    </div>
                    {hotel.TrangThai === 'Chờ duyệt' && (
                      <>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[12px] text-muted">Trạng thái</span>
                          <strong className="text-[14px] font-semibold text-warning-ink">Đang chờ xử lý</strong>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 min-w-[160px] flex-shrink-0">
                  {hotel.TrangThai === 'Hoạt động' && (
                    <Link to={`/owner/hotels/${hotel.MaKhachSan}`} className="btn btn-primary btn-sm flex justify-center py-2">
                      Quản lý khách sạn
                    </Link>
                  )}
                  {hotel.TrangThai === 'Chờ duyệt' && (
                    <Link to={`/owner/hotels/${hotel.MaKhachSan}`} className="btn btn-secondary btn-sm flex justify-center py-2">
                      Xem chi tiết hồ sơ
                    </Link>
                  )}
                  {hotel.TrangThai !== 'Hoạt động' && hotel.TrangThai !== 'Chờ duyệt' && (
                    <Link to={`/owner/hotels/${hotel.MaKhachSan}`} className="btn btn-secondary btn-sm flex justify-center py-2">
                      Xem chi tiết
                    </Link>
                  )}
                  {hotel.TrangThai !== 'Chờ duyệt' && (
                    <Link to={`/owner/hotels/${hotel.MaKhachSan}/reviews`} className="btn btn-outline btn-sm flex justify-center py-2">
                      <i className="ph ph-star" aria-hidden="true"></i> Xem đánh giá
                    </Link>
                  )}
                </div>
              </article>
            ))}
            {visibleHotels.length === 0 && <p className="py-8 text-sm text-muted">{hotels.length === 0 ? 'Bạn chưa có khách sạn nào.' : 'Không tìm thấy khách sạn phù hợp với bộ lọc.'}</p>}
          </div>
        </>
      )}
    </div>
  );
}

const money = (value: number | null) => (value === null ? 'Chưa có dữ liệu' : formatCurrencyVND(value));
const PREVIOUS_LABEL = `${KPI_PERIOD_DAYS} ngày trước`;

function KpiGrid({ current, previous }: { current: OwnerAnalytics; previous: OwnerAnalytics | undefined }) {
  const now = computeKpis(current);
  const before = previous ? computeKpis(previous) : null;
  return (
    <div aria-label="Chỉ số chính" role="group" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Công suất phòng"
        value={now.occupancy === null ? 'Chưa có dữ liệu' : `${now.occupancy}%`}
        change={before && changeVersusPrevious(now.occupancy, before.occupancy, 'points', PREVIOUS_LABEL)}
      />
      <KpiCard
        label="ADR (giá phòng trung bình)"
        value={money(now.adr)}
        change={before && changeVersusPrevious(now.adr, before.adr, 'percent', PREVIOUS_LABEL)}
        note="Ước tính: doanh thu thực nhận chia số phòng-đêm đã bán"
      />
      <KpiCard
        label="RevPAR"
        value={money(now.revpar)}
        change={before && changeVersusPrevious(now.revpar, before.revpar, 'percent', PREVIOUS_LABEL)}
        note="Ước tính: doanh thu thực nhận chia số phòng-đêm có thể bán"
      />
      <KpiCard
        label="Đặt phòng mới"
        value={now.newBookings.toLocaleString('vi-VN')}
        change={before && changeVersusPrevious(now.newBookings, before.newBookings, 'percent', PREVIOUS_LABEL)}
      />
    </div>
  );
}

/** What needs the owner today. Only counts the API can give: confirmed bookings checking in today. */
function TodayPanel({ checkIns, isError, to }: { checkIns: number | undefined; isError: boolean; to: string }) {
  return (
    <Card>
      <h3 className="font-semibold text-heading">Hôm nay</h3>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        <li>
          <Link to={to} className="block rounded-lg bg-surface-secondary p-3 transition-colors hover:bg-primary-50">
            <span className="text-2xl font-semibold text-ink">{isError ? '—' : (checkIns ?? '…')}</span>
            <span className="block text-sm text-ink-muted">khách nhận phòng</span>
          </Link>
        </li>
      </ul>
    </Card>
  );
}
