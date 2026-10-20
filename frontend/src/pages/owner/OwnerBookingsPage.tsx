import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useOwnerBookings } from '../../features/owner/hooks';
import type { OwnerBooking } from '../../features/owner/types';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { formatCurrencyVND, formatDateVi } from '../../lib/utils';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { OwnerHotelContextSelector, OwnerHotelScopeState } from '../../components/owner/OwnerHotelContext';
import { useOwnerHotelContext } from '../../features/owner/context';
import { BOOKING_STATUS } from '../../features/bookings/status';
import { PageSpinner } from '../../components/common/PageSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import { FilterBar } from '../../components/common/FilterBar';
import { DataTable, type Column } from '../../components/common/DataTable';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '../../components/common/Button';
import { Icon } from '../../components/common/Icon';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';


function getStatusBadge(status: string) { return <StatusBadge domain="booking" status={status} />; }

export default function OwnerBookingsPage() {
  const scope = useOwnerHotelContext();
  const hotelId = scope.hotelId ?? 0;
  const [params, setParams] = useSearchParams();
  
  const filters = { 
    page: Number(params.get('page') ?? 1), 
    limit: 20, 
    trangThai: params.get('trangThai') ?? undefined, 
    search: params.get('search') ?? undefined, 
    from: params.get('from') ?? undefined, 
    to: params.get('to') ?? undefined 
  };
  
  const query = useOwnerBookings(hotelId, filters);

  // Bộ lọc nằm trên URL nhưng thay thế lịch sử
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next, { replace: true });
  };
  const setPage = (page: number) => {
    const next = new URLSearchParams(params);
    if (page > 1) next.set('page', String(page));
    else next.delete('page');
    setParams(next);
  };

  // Ô nhập cục bộ có debounce
  const [searchInput, setSearchInput] = useState(filters.search ?? '');
  const debouncedSearch = useDebouncedValue(searchInput.trim());
  useEffect(() => {
    if (debouncedSearch !== (params.get('search') ?? '')) setFilter('search', debouncedSearch);
    // Chỉ phản ứng khi giá trị đã ổn định
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the settled input
  }, [debouncedSearch]);

  const resetFilters = () => {
    setSearchInput('');
    const next = new URLSearchParams();
    if (scope.hotelId) next.set('hotelId', String(scope.hotelId));
    setParams(next, { replace: true });
  };

  // Chỉ lần tải đầu thay trang, các lần sau giữ dòng cũ
  if (scope.hotelsQuery.isLoading) {
    return <PageSpinner />;
  }

  if (scope.hotelsQuery.isError) {
    return (
      <div role="alert" className="mx-auto max-w-md rounded-lg bg-danger-light px-4 py-3 text-center text-sm text-danger-ink border border-danger/30">
        Lỗi tải dữ liệu. Vui lòng thử lại.
      </div>
    );
  }

  const hotel = scope.hotel;
  const result = query.data;

  const columns: Column<OwnerBooking>[] = [
    { key: 'id', header: '#', align: 'center', className: 'w-10', cell: (b) => <span className="font-mono text-xs text-ink-muted">{b.MaDatPhong}</span> },
    { key: 'code', header: 'Mã Booking', cell: (b) => <span className="font-mono font-bold text-primary">{b.MaXacNhanDatPhong}</span> },
    {
      key: 'guest',
      header: 'Khách hàng',
      cell: (b) => (
        <>
          <div className="font-bold text-ink">{b.KhachHang.HoTen}</div>
          <div className="text-xs text-ink-muted">{b.KhachHang.SoDienThoai}</div>
        </>
      ),
    },
    { key: 'checkin', header: 'Ngày nhận phòng', cell: (b) => <span className="font-medium text-ink">{formatDateVi(b.NgayNhanPhong)}</span> },
    { key: 'checkout', header: 'Ngày trả phòng', cell: (b) => <span className="font-medium text-ink">{formatDateVi(b.NgayTraPhong)}</span> },
    { key: 'rooms', header: 'Phòng', cell: (b) => <span className="text-xs text-ink-sub">{b.ChiTietPhong.map((room) => `${room.TenLoaiPhong} × ${room.SoLuong}`).join(', ')}</span> },
    {
      key: 'total',
      header: 'Tổng tiền',
      align: 'right',
      cell: (b) => (
        <>
          <div className="font-extrabold text-ink">{formatCurrencyVND(b.TongTienThanhToan)}</div>
          {b.TrangThai === BOOKING_STATUS.CONFIRMED && <span className="rounded bg-success-light px-1.5 py-0.5 text-[10px] font-semibold text-success-ink">Đã thanh toán</span>}
        </>
      ),
    },
    { key: 'status', header: 'Trạng thái', align: 'center', cell: (b) => getStatusBadge(b.TrangThai) },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      cell: (b) => (
        <Link to={`/owner/bookings/${b.MaDatPhong}?hotelId=${hotelId}`} className="admin-row-link">
          <span>Chi tiết</span>
          <Icon name="caret-right" />
        </Link>
      ),
    },
  ];


  return (
    <div className="owner-module flex flex-col gap-6 max-w-[1200px] mx-auto w-full">
      <header className="owner-module__header"><div><h1>Đặt phòng</h1><p className="page-header__desc">Tra cứu và theo dõi các đặt phòng của khách sạn đang chọn.</p></div></header>
      <OwnerHotelContextSelector hotels={scope.hotels} hotelId={scope.hotelId} onChange={scope.selectHotel} />
      <OwnerHotelScopeState loading={false} error={scope.hotelsQuery.error} empty={scope.hotels.length === 0} invalid={scope.invalidHotelId} />
      {!hotelId && scope.hotels.length > 1 && <div className="owner-scope-state">Chọn khách sạn để tải danh sách đặt phòng.</div>}
      {hotelId > 0 && query.isLoading && !result && <div role="status" className="owner-scope-state">Đang tải đặt phòng…</div>}
      {hotelId > 0 && query.isError && <div role="alert" className="owner-scope-state is-error">Không thể tải danh sách đặt phòng.</div>}
      {hotelId > 0 && hotel && result && <>

      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-surface-tertiary flex items-center justify-center text-ink-sub border border-border">
          <i className="ph-fill ph-buildings text-[20px]"></i>
        </div>
        <div className="relative">
          <span className="text-xs font-medium text-ink-muted block leading-tight">Đang quản lý cơ sở:</span>
          <span className="flex items-center gap-2 text-sm font-bold text-ink">{hotel.TenKhachSan}</span>
        </div>
      </div>

      <PageHeader
        title={`Đặt phòng · ${hotel.TenKhachSan}`}
        description="Theo dõi, kiểm tra chi tiết và tiếp đón khách hàng theo thời gian thực."
        actions={<Button type="button" onClick={() => query.refetch()}><Icon name="arrows-clockwise" /> Làm mới</Button>}
      />

      <FilterBar onReset={resetFilters}>
        <div className="min-w-[220px] flex-[2]">
          <Input label="Tìm kiếm booking" type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Mã booking, tên khách..." />
        </div>
        <div className="min-w-[180px] flex-1">
          <Select label="Trạng thái đặt phòng" value={filters.trangThai ?? ''} onChange={(e) => setFilter('trangThai', e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {Object.values(BOOKING_STATUS).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
        <div className="min-w-[260px] flex-[2]">
          <p id="owner-bookings-range-label" className="ui-field-label">Khoảng ngày Check-in</p>
          <div role="group" aria-labelledby="owner-bookings-range-label" className="flex items-center gap-2">
            <Input type="date" aria-label="Nhận phòng từ ngày" value={filters.from ?? ''} onChange={(e) => setFilter('from', e.target.value)} />
            <span className="text-xs font-medium text-ink-muted" aria-hidden="true">→</span>
            <Input type="date" aria-label="Nhận phòng đến ngày" min={filters.from} value={filters.to ?? ''} onChange={(e) => setFilter('to', e.target.value)} />
          </div>
        </div>
      </FilterBar>

      <div className="owner-bookings-results surface-card flex flex-col overflow-hidden">
        {result.items.length === 0 ? (
          <EmptyState title="Không tìm thấy đặt phòng" description="Thử thay đổi từ khóa hoặc xóa bộ lọc." icon="calendar-x" />
        ) : (
          <>
          <div className="owner-bookings-table hidden md:block">
            <DataTable bare caption="Danh sách đặt phòng" columns={columns} rows={result.items} getRowKey={(b) => b.MaDatPhong} />
          </div>
          <div className="owner-bookings-mobile-list md:hidden divide-y divide-border">
            {result.items.map((booking) => (
              <article key={booking.MaDatPhong} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-bold text-primary break-all">{booking.MaXacNhanDatPhong}</p>
                    <p className="mt-1 font-semibold text-heading">{booking.KhachHang.HoTen}</p>
                    <p className="text-sm text-muted">{booking.KhachHang.SoDienThoai}</p>
                  </div>
                  {getStatusBadge(booking.TrangThai)}
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div><dt className="text-xs text-muted">Nhận phòng</dt><dd className="font-medium text-heading">{formatDateVi(booking.NgayNhanPhong)}</dd></div>
                  <div><dt className="text-xs text-muted">Trả phòng</dt><dd className="font-medium text-heading">{formatDateVi(booking.NgayTraPhong)}</dd></div>
                  <div className="col-span-2"><dt className="text-xs text-muted">Phòng</dt><dd className="font-medium text-heading">{booking.ChiTietPhong.map((room) => `${room.TenLoaiPhong} × ${room.SoLuong}`).join(', ')}</dd></div>
                  <div className="col-span-2"><dt className="text-xs text-muted">Tổng thanh toán</dt><dd className="font-bold text-heading">{formatCurrencyVND(booking.TongTienThanhToan)}</dd></div>
                </dl>
                <Link to={`/owner/bookings/${booking.MaDatPhong}?hotelId=${hotelId}`} className="btn btn-outline btn-sm w-full justify-center">Xem chi tiết</Link>
              </article>
            ))}
          </div>
          </>
        )}
        <div className="flex items-center justify-between border-t border-border bg-surface-secondary/50 px-6 py-4 text-xs text-ink-muted">
          <span>Tổng cộng {result.pagination.total} kết quả</span>
          {result.pagination.totalPages > 1 && (
            <nav aria-label="Phân trang đặt phòng" className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPage(filters.page - 1)} disabled={filters.page <= 1}>Trước</Button>
              <span aria-current="page">Trang {result.pagination.page}/{result.pagination.totalPages}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => setPage(filters.page + 1)} disabled={filters.page >= result.pagination.totalPages}>Sau</Button>
            </nav>
          )}
        </div>
      </div>
      </>}
    </div>
  );
}
