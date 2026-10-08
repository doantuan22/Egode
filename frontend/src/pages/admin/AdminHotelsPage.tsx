import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../services/apiClient';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { listAdminHotels, type AdminHotel } from '../../features/admin/hotels/api';
import { useListParams, useUrlSearchInput } from '../../hooks/useListParams';
import { Pagination } from '../../components/common/Pagination';
import { PageHeader } from '../../components/common/PageHeader';
import { FilterBar } from '../../components/common/FilterBar';
import { DataTable, type Column } from '../../components/common/DataTable';
import { Icon } from '../../components/common/Icon';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { AdminListPanel } from '../../components/admin/AdminListPanel';

const FILTER_DEFAULTS = { search: '', status: '' };

export default function AdminHotelsPage() {
  const { values, page, setValue, setPage, reset } = useListParams(FILTER_DEFAULTS);
  const [search, setSearch] = useUrlSearchInput(values.search, (value) => setValue('search', value));
  const debouncedSearch = values.search;
  const status = values.status;

  const query = useQuery({
    queryKey: ['admin', 'hotels', page, debouncedSearch, status],
    queryFn: () => listAdminHotels({ page, limit: 20, search: debouncedSearch || undefined, TrangThai: status || undefined }),
  });
  const activeFilterCount = Number(Boolean(debouncedSearch)) + Number(Boolean(status));

  const columns: Column<AdminHotel>[] = [
    {
      key: 'name',
      header: 'Khách sạn',
      cell: (hotel) => (
        <>
          <div className="font-bold text-heading">{hotel.TenKhachSan}</div>
          <div className="mt-0.5 font-mono text-[11px] text-ink-muted">#{hotel.MaKhachSan}</div>
        </>
      ),
    },
    {
      key: 'location',
      header: 'Địa phương',
      cell: (hotel) => <span className="font-medium text-ink-sub">{hotel.DIA_PHUONG?.TenThanhPho ?? '—'}</span>,
    },
    { key: 'status', header: 'Trạng thái', align: 'center', cell: (hotel) => <StatusBadge domain="hotel" status={hotel.TrangThai} /> },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      cell: (hotel) => (
        <Link to={`/admin/hotels/${hotel.MaKhachSan}`} className="admin-row-link">
          <span>Quản lý</span>
          <Icon name="caret-right" size={14} />
        </Link>
      ),
    },
  ];

  return (
    <div className="admin-page-shell max-w-[1200px] mx-auto w-full">
      <PageHeader
        title="Quản lý khách sạn"
        description="Theo dõi cơ sở lưu trú đối tác, trạng thái mở bán và các trường hợp cần can thiệp."
      />

      <AdminListPanel
        itemLabel="khách sạn"
        total={query.data?.pagination.total}
        activeFilterCount={activeFilterCount}
        onRefresh={() => void query.refetch()}
        refreshing={query.isFetching}
        filters={
          <FilterBar onReset={activeFilterCount > 0 ? reset : undefined}>
            <div className="min-w-[240px] flex-[2]">
              <Input
                label="Tìm kiếm"
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Nhập tên khách sạn..."
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <Select
                label="Trạng thái"
                value={status}
                onChange={(e) => {
                  setValue('status', e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="Hoạt động">Đang hoạt động</option>
                <option value="Đình chỉ">Đình chỉ</option>
              </Select>
            </div>
          </FilterBar>
        }
      >
        <DataTable
          bare
          caption="Danh sách khách sạn"
          columns={columns}
          rows={query.data?.items}
          getRowKey={(hotel) => hotel.MaKhachSan}
          isLoading={query.isLoading}
          error={query.isError ? (query.error instanceof ApiError ? query.error.message : 'Không thể tải khách sạn') : null}
          emptyTitle="Không tìm thấy khách sạn phù hợp"
          emptyDescription="Hãy thay đổi từ khóa hoặc bộ lọc trạng thái."
          emptyIcon="buildings"
          footer={
            query.data && (
              <Pagination
                page={page}
                totalPages={query.data.pagination.totalPages}
                total={query.data.pagination.total}
                itemLabel="khách sạn"
                onPageChange={setPage}
              />
            )
          }
        />
      </AdminListPanel>
    </div>
  );
}
