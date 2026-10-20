import { Link } from 'react-router-dom';
import { useAdminSupportList } from '../../features/support/hooks';
import { ApiError } from '../../services/apiClient';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { useListParams, useUrlSearchInput } from '../../hooks/useListParams';
import { Pagination } from '../../components/common/Pagination';
import { PageHeader } from '../../components/common/PageHeader';
import { FilterBar } from '../../components/common/FilterBar';
import { DataTable, type Column } from '../../components/common/DataTable';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import type { AdminSupportListItem } from '../../features/support/types';
import { Icon } from '../../components/common/Icon';
import { AdminListPanel } from '../../components/admin/AdminListPanel';

const PAGE_SIZE = 10;
const STATUSES = ['Mới', 'Đang xử lý', 'Đã xử lý'];
const TYPES = ['Hỗ trợ', 'Khiếu nại'];

const FILTER_DEFAULTS = { search: '', status: '', type: '' };

export default function AdminSupportPage() {
  const { values, page, setValue, setPage, reset } = useListParams(FILTER_DEFAULTS);
  const [searchInput, setSearchInput] = useUrlSearchInput(values.search, (value) => setValue('search', value));
  const search = values.search;
  const status = values.status;
  const setStatus = (value: string) => setValue('status', value);
  const type = values.type;
  const setType = (value: string) => setValue('type', value);
  // URL cũ dùng ALL nên chuẩn hóa về giá trị mặc định
  const selectedStatus = status === 'ALL' ? '' : status;

  const query = useAdminSupportList({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    trangThai: selectedStatus || undefined,
    loaiYeuCau: type || undefined,
  });

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    setPage(1);
  };

  const activeFilterCount = Number(Boolean(search)) + Number(Boolean(selectedStatus)) + Number(Boolean(type));

  const columns: Column<AdminSupportListItem>[] = [
    { key: 'id', header: 'Mã Ticket', cell: (r) => <span className="font-mono text-sm font-bold text-primary-600">#TCK-{r.MaYeuCauHoTro}</span> },
    { key: 'customer', header: 'Khách hàng', cell: (r) => <span className="font-bold text-heading">{r.TAI_KHOAN_YEU_CAU_HO_TRO_MaTaiKhoanKhachHangToTAI_KHOAN.HoTen}</span> },
    { key: 'type', header: 'Phân loại', align: 'center', cell: (r) => <span className="admin-neutral-tag">{r.LoaiYeuCau}</span> },
    { key: 'title', header: 'Tiêu đề yêu cầu', cell: (r) => <span className="font-medium text-ink">{r.TieuDe}</span> },
    { key: 'status', header: 'Trạng thái', align: 'center', cell: (r) => <StatusBadge domain="support" status={r.TrangThai} /> },
    { key: 'actions', header: 'Xử lý', align: 'center', cell: (r) => <Link to={`/admin/support/${r.MaYeuCauHoTro}`} className="admin-row-link"><span>Phản hồi</span><Icon name="caret-right" size={14} /></Link> },
  ];

  const resetFilters = () => {
    setSearchInput('');
    reset();
  };

  return (
    <div className="admin-page-shell max-w-[1200px] mx-auto w-full">
      <PageHeader title="Hỗ trợ & Khiếu nại" description="Tiếp nhận yêu cầu trợ giúp, xử lý mâu thuẫn đặt phòng từ khách hàng và đối tác." />

      <AdminListPanel
        itemLabel="yêu cầu"
        total={query.data?.pagination.total}
        activeFilterCount={activeFilterCount}
        onRefresh={() => void query.refetch()}
        refreshing={query.isFetching}
        filters={
          <FilterBar>
            <div className="admin-support-filters__fields basis-full">
              <div className="admin-support-filters__search">
                <Input label="Tìm kiếm" type="search" value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Mã ticket, tiêu đề hoặc tên khách hàng..." />
              </div>
              <div className="admin-support-filters__status-select">
                <Select label="Trạng thái xử lý" value={selectedStatus} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                  <option value="">Tất cả trạng thái</option>
                  {STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
                </Select>
              </div>
              <div className="admin-support-filters__type">
                <Select label="Phân loại" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
                  <option value="">Tất cả phân loại</option>
                  {TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                </Select>
              </div>
            </div>

            {activeFilterCount > 0 && (
              <div className="admin-active-filters admin-support-filters__active basis-full" aria-label="Bộ lọc đang dùng">
                <span className="admin-support-filters__active-label">Đang lọc:</span>
                {search && (
                  <button type="button" aria-label={`Bỏ từ khóa ${search}`} onClick={() => { setSearchInput(''); setPage(1); }} title={`Bỏ từ khóa ${search}`}>
                    Từ khóa: <span className="admin-support-filters__active-value">{search}</span> <span aria-hidden="true">×</span>
                  </button>
                )}
                {selectedStatus && (
                  <button type="button" aria-label={`Bỏ bộ lọc trạng thái ${selectedStatus}`} onClick={() => { setStatus(''); setPage(1); }}>
                    Trạng thái: {selectedStatus} <span aria-hidden="true">×</span>
                  </button>
                )}
                {type && (
                  <button type="button" aria-label={`Bỏ bộ lọc phân loại ${type}`} onClick={() => { setType(''); setPage(1); }}>
                    Phân loại: {type} <span aria-hidden="true">×</span>
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
          caption="Danh sách yêu cầu hỗ trợ và khiếu nại"
          columns={columns}
          rows={query.data?.items}
          getRowKey={(r) => r.MaYeuCauHoTro}
          isLoading={query.isLoading}
          error={query.isError ? (query.error instanceof ApiError ? query.error.message : 'Không thể tải danh sách yêu cầu') : null}
          emptyTitle="Không tìm thấy yêu cầu nào"
          emptyDescription="Chưa có ticket nào phù hợp với bộ lọc."
          emptyIcon="chat-circle-dots"
          footer={query.data && (
            <Pagination page={page} totalPages={query.data.pagination.totalPages} total={query.data.pagination.total} itemLabel="yêu cầu" onPageChange={setPage} />
          )}
        />
      </AdminListPanel>
    </div>
  );
}
