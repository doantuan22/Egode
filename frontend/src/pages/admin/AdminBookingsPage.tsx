import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../services/apiClient';
import { listAdminBookings, type AdminBookingListItem } from '../../features/admin/bookings/api';
import { BOOKING_STATUS } from '../../features/bookings/status';
import { useListParams, useUrlSearchInput } from '../../hooks/useListParams';
import { formatCurrencyVND, formatDateRangeVi, formatDateTimeVi } from '../../lib/utils';
import { AdminListPanel } from '../../components/admin/AdminListPanel';
import { DataTable, type Column } from '../../components/common/DataTable';
import { FilterBar } from '../../components/common/FilterBar';
import { Icon } from '../../components/common/Icon';
import { Input } from '../../components/common/Input';
import { PageHeader } from '../../components/common/PageHeader';
import { Pagination } from '../../components/common/Pagination';
import { Select } from '../../components/common/Select';
import { StatusBadge } from '../../components/domain/StatusBadge';

const PAGE_SIZE = 20;
const FILTER_DEFAULTS = { search: '', status: '', from: '', to: '' };

export default function AdminBookingsPage() {
  const { values, page, setValue, setPage, reset } = useListParams(FILTER_DEFAULTS);
  const [searchInput, setSearchInput] = useUrlSearchInput(values.search, (value) => setValue('search', value));
  const status = values.status === 'ALL' ? '' : values.status;

  const query = useQuery({
    queryKey: ['admin', 'bookings', page, values.search, status, values.from, values.to],
    queryFn: () => listAdminBookings({
      page,
      limit: PAGE_SIZE,
      search: values.search || undefined,
      trangThai: status || undefined,
      from: values.from || undefined,
      to: values.to || undefined,
    }),
  });

  const activeFilterCount = Number(Boolean(values.search)) + Number(Boolean(status)) + Number(Boolean(values.from || values.to));
  const resetFilters = () => {
    setSearchInput('');
    reset();
  };

  const columns: Column<AdminBookingListItem>[] = [
    {
      key: 'code',
      header: 'Mã booking',
      cell: (booking) => (
        <div>
          <div className="font-mono font-bold text-primary-600">#{booking.MaXacNhanDatPhong}</div>
          <div className="mt-0.5 text-[10px] text-ink-muted">Tạo {formatDateTimeVi(booking.NgayTao)}</div>
        </div>
      ),
    },
    {
      key: 'hotel',
      header: 'Khách sạn',
      cell: (booking) => <Link to={`/admin/hotels/${booking.KhachSan.MaKhachSan}`} className="font-semibold text-heading hover:text-primary">{booking.KhachSan.TenKhachSan}</Link>,
    },
    {
      key: 'customer',
      header: 'Khách hàng',
      cell: (booking) => (
        <div>
          <div className="font-semibold text-heading">{booking.KhachHang.HoTen}</div>
          <div className="mt-0.5 text-[11px] text-ink-muted">{booking.KhachHang.SoDienThoai}</div>
        </div>
      ),
    },
    { key: 'stay', header: 'Thời gian lưu trú', cell: (booking) => <span className="whitespace-nowrap font-medium text-ink-sub">{formatDateRangeVi(booking.NgayNhanPhong, booking.NgayTraPhong, ' → ')}</span> },
    { key: 'rooms', header: 'Số phòng', align: 'center', cell: (booking) => <strong className="text-heading">{booking.TongSoPhong}</strong> },
    { key: 'total', header: 'Tổng tiền', align: 'right', cell: (booking) => <strong className="whitespace-nowrap text-heading">{formatCurrencyVND(booking.TongTienThanhToan)}</strong> },
    { key: 'status', header: 'Trạng thái', align: 'center', cell: (booking) => <StatusBadge domain="booking" status={booking.TrangThai} /> },
    {
      key: 'detail',
      header: 'Chi tiết',
      align: 'center',
      cell: (booking) => <Link to={`/admin/bookings/${booking.MaDatPhong}`} className="admin-row-link"><span>Chi tiết</span><Icon name="caret-right" size={14} /></Link>,
    },
  ];

  return (
    <div className="admin-page-shell mx-auto w-full max-w-[1200px]">
      <PageHeader title="Danh sách đặt phòng" description="Tra cứu và theo dõi toàn bộ đặt phòng phát sinh trên hệ thống." />

      <AdminListPanel
        itemLabel="đặt phòng"
        total={query.data?.pagination.total}
        activeFilterCount={activeFilterCount}
        onRefresh={() => void query.refetch()}
        refreshing={query.isFetching}
        filters={
          <FilterBar>
            <div className="admin-booking-filters__fields basis-full">
              <div className="admin-booking-filters__search">
                <Input
                  label="Tìm kiếm"
                  type="search"
                  value={searchInput}
                  onChange={(event) => { setSearchInput(event.target.value); setPage(1); }}
                  placeholder="Mã booking, khách hàng hoặc khách sạn..."
                />
              </div>
              <div className="admin-booking-filters__status-select">
                <Select label="Trạng thái đặt phòng" value={status} onChange={(event) => { setValue('status', event.target.value); setPage(1); }}>
                  <option value="">Tất cả trạng thái</option>
                  {Object.values(BOOKING_STATUS).map((item) => <option key={item} value={item}>{item}</option>)}
                </Select>
              </div>
              <div className="admin-booking-filters__date-range">
                <p id="admin-booking-date-filter" className="ui-field-label">Ngày nhận phòng</p>
                <div role="group" aria-labelledby="admin-booking-date-filter" className="admin-booking-filters__date-inputs">
                  <Input type="date" aria-label="Nhận phòng từ ngày" value={values.from} onChange={(event) => { setValue('from', event.target.value); setPage(1); }} />
                  <span aria-hidden="true">→</span>
                  <Input type="date" aria-label="Nhận phòng đến ngày" min={values.from || undefined} value={values.to} onChange={(event) => { setValue('to', event.target.value); setPage(1); }} />
                </div>
              </div>
            </div>

            {activeFilterCount > 0 && (
              <div className="admin-active-filters admin-booking-filters__active basis-full" aria-label="Bộ lọc đang dùng">
                <span className="admin-booking-filters__active-label">Đang lọc:</span>
                {values.search && (
                  <button type="button" aria-label={`Bỏ từ khóa ${values.search}`} onClick={() => { setSearchInput(''); setPage(1); }}>
                    Từ khóa: <span className="admin-booking-filters__active-value">{values.search}</span> <span aria-hidden="true">×</span>
                  </button>
                )}
                {status && (
                  <button type="button" aria-label={`Bỏ bộ lọc trạng thái ${status}`} onClick={() => { setValue('status', ''); setPage(1); }}>
                    Trạng thái: {status} <span aria-hidden="true">×</span>
                  </button>
                )}
                {(values.from || values.to) && (
                  <button type="button" aria-label="Bỏ bộ lọc ngày nhận phòng" onClick={() => { setValue('from', ''); setValue('to', ''); setPage(1); }}>
                    Nhận phòng: {values.from || 'đầu kỳ'} → {values.to || 'hiện tại'} <span aria-hidden="true">×</span>
                  </button>
                )}
                <button type="button" className="admin-active-filters__clear" onClick={resetFilters}>Xóa tất cả</button>
              </div>
            )}
          </FilterBar>
        }
      >
        <DataTable
          bare
          caption="Danh sách đặt phòng toàn hệ thống"
          columns={columns}
          rows={query.data?.items}
          getRowKey={(booking) => booking.MaDatPhong}
          isLoading={query.isLoading}
          error={query.isError ? (query.error instanceof ApiError ? query.error.message : 'Không thể tải danh sách đặt phòng') : null}
          emptyTitle="Không tìm thấy đặt phòng nào"
          emptyDescription="Chưa có đặt phòng phù hợp với các điều kiện đang chọn."
          emptyIcon="calendar-x"
          footer={query.data && (
            <Pagination page={page} totalPages={query.data.pagination.totalPages} total={query.data.pagination.total} itemLabel="đặt phòng" onPageChange={setPage} />
          )}
        />
      </AdminListPanel>
    </div>
  );
}
