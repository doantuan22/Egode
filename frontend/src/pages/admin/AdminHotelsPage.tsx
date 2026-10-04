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

const FILTER_DEFAULTS = { search: '', status: '' };

export default function AdminHotelsPage() {
  const { values, page, setValue, setPage, reset } = useListParams(FILTER_DEFAULTS);
  const [search, setSearch] = useUrlSearchInput(values.search, (value) => setValue('search', value));
  const debouncedSearch = values.search;
  const status = values.status;
  const setStatus = (value: string) => setValue('status', value);
  
  const query = useQuery({ 
    queryKey: ['admin', 'hotels', page, debouncedSearch, status], 
    queryFn: () => listAdminHotels({ page, limit: 20, search: debouncedSearch || undefined, TrangThai: status || undefined }) 
  });
  
  const resetFilters = () => reset();

  const columns: Column<AdminHotel>[] = [
    {
      key: 'name',
      header: 'Tên cơ sở khách sạn',
      cell: (hotel) => (
        <>
          <div className="font-bold text-heading">{hotel.TenKhachSan}</div>
          <div className="mt-0.5 font-mono text-[11px] text-ink-muted">#{hotel.MaKhachSan}</div>
        </>
      ),
    },
    { key: 'location', header: 'Địa phương', cell: (hotel) => <span className="font-medium text-ink-sub">{hotel.DIA_PHUONG?.TenThanhPho ?? '—'}</span> },
    { key: 'status', header: 'Trạng thái', align: 'center', cell: (hotel) => <StatusBadge domain="hotel" status={hotel.TrangThai} /> },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      cell: (hotel) => (
        <Link to={`/admin/hotels/${hotel.MaKhachSan}`} className="admin-row-link">
          <span>Chi tiết</span>
          <Icon name="caret-right" />
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto w-full">
      <PageHeader title="Quản lý khách sạn" description="Giám sát toàn bộ cơ sở lưu trú đối tác, trạng thái mở bán và xử lý rủi ro." />

      <FilterBar onReset={resetFilters}>
        <div className="min-w-[240px] flex-[2]">
          <Input label="Tìm kiếm khách sạn" type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Nhập tên khách sạn..." />
        </div>
        <div className="min-w-[200px] flex-1">
          <Select label="Trạng thái hoạt động" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Tất cả trạng thái</option>
            <option value="Chờ duyệt">Chờ duyệt</option>
            <option value="Hoạt động">Đang hoạt động</option>
            <option value="Từ chối">Từ chối</option>
            <option value="Đình chỉ">Đình chỉ</option>
            <option value="Ngừng hoạt động">Ngừng hoạt động</option>
          </Select>
        </div>
      </FilterBar>

      <DataTable
        caption="Danh sách khách sạn"
        columns={columns}
        rows={query.data?.items}
        getRowKey={(hotel) => hotel.MaKhachSan}
        isLoading={query.isLoading}
        error={query.isError ? (query.error instanceof ApiError ? query.error.message : 'Không thể tải khách sạn') : null}
        emptyTitle="Không tìm thấy khách sạn phù hợp"
        emptyDescription="Vui lòng kiểm tra lại từ khóa hoặc xóa bớt tiêu chí lọc trạng thái."
        emptyIcon="buildings"
        footer={query.data && (
          <Pagination page={page} totalPages={query.data.pagination.totalPages} total={query.data.pagination.total} itemLabel="khách sạn" onPageChange={setPage} />
        )}
      />
    </div>
  );
}
