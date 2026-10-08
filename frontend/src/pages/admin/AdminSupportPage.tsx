import { Link } from 'react-router-dom';
import { useAdminSupportList } from '../../features/support/hooks';
import { ApiError } from '../../services/apiClient';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { useListParams, useUrlSearchInput } from '../../hooks/useListParams';
import { Pagination } from '../../components/common/Pagination';
import { PageHeader } from '../../components/common/PageHeader';
import { FilterBar } from '../../components/common/FilterBar';
import { FilterChip } from '../../components/common/FilterChip';
import { DataTable, type Column } from '../../components/common/DataTable';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import type { AdminSupportListItem } from '../../features/support/types';

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

  const query = useAdminSupportList({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    trangThai: status === 'ALL' ? undefined : status || undefined,
    loaiYeuCau: type || undefined,
  });

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    setPage(1);
  };

  const columns: Column<AdminSupportListItem>[] = [
    { key: 'id', header: 'Mã Ticket', cell: (r) => <span className="font-mono text-sm font-bold text-primary-600">#TCK-{r.MaYeuCauHoTro}</span> },
    { key: 'customer', header: 'Khách hàng', cell: (r) => <span className="font-bold text-heading">{r.TAI_KHOAN_YEU_CAU_HO_TRO_MaTaiKhoanKhachHangToTAI_KHOAN.HoTen}</span> },
    { key: 'type', header: 'Phân loại', align: 'center', cell: (r) => <span className="rounded-md bg-surface-tertiary px-2 py-0.5 text-[11px] font-medium text-ink-sub">{r.LoaiYeuCau}</span> },
    { key: 'title', header: 'Tiêu đề yêu cầu', cell: (r) => <span className="font-medium text-ink">{r.TieuDe}</span> },
    { key: 'status', header: 'Trạng thái', align: 'center', cell: (r) => <StatusBadge domain="support" status={r.TrangThai} /> },
    { key: 'actions', header: 'Xử lý', align: 'center', cell: (r) => <Link to={`/admin/support/${r.MaYeuCauHoTro}`} className="admin-row-link">Phản hồi</Link> },
  ];

  const resetFilters = () => reset();

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto w-full">
      <PageHeader title="Hỗ trợ & Khiếu nại" description="Tiếp nhận yêu cầu trợ giúp, xử lý mâu thuẫn đặt phòng từ khách hàng và đối tác." />

      <FilterBar onReset={resetFilters}>
        <div role="group" aria-label="Lọc theo trạng thái yêu cầu" className="flex basis-full gap-2 overflow-x-auto">
          {['ALL', ...STATUSES].map((st) => (
            <FilterChip key={st} pressed={status === st || (st === 'ALL' && !status)} onClick={() => { setStatus(st); setPage(1); }}>
              {st === 'ALL' ? 'Tất cả ticket' : st}
            </FilterChip>
          ))}
        </div>
        <div className="min-w-[240px] flex-[2]">
          <Input label="Tìm yêu cầu" type="text" value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Tìm mã ticket, tiêu đề hoặc khách hàng..." />
        </div>
        <div className="min-w-[180px] flex-1">
          <Select label="Phân loại" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
            <option value="">Tất cả phân loại</option>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
      </FilterBar>

      <DataTable
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
    </div>
  );
}
