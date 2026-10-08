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
import { AdminListPanel } from '../../components/admin/AdminListPanel';
import { Icon } from '../../components/common/Icon';
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
  const type = values.type;

  const query = useAdminSupportList({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    trangThai: status === 'ALL' ? undefined : status || undefined,
    loaiYeuCau: type || undefined,
  });
  const activeFilterCount = Number(Boolean(search)) + Number(Boolean(status && status !== 'ALL')) + Number(Boolean(type));

  const columns: Column<AdminSupportListItem>[] = [
    {
      key: 'id',
      header: 'Mã ticket',
      cell: (r) => <span className="font-mono text-sm font-bold text-primary-600">#TCK-{r.MaYeuCauHoTro}</span>,
    },
    {
      key: 'customer',
      header: 'Khách hàng',
      cell: (r) => <span className="font-bold text-heading">{r.TAI_KHOAN_YEU_CAU_HO_TRO_MaTaiKhoanKhachHangToTAI_KHOAN.HoTen}</span>,
    },
    { key: 'type', header: 'Phân loại', align: 'center', cell: (r) => <span className="admin-neutral-tag">{r.LoaiYeuCau}</span> },
    { key: 'title', header: 'Tiêu đề', cell: (r) => <span className="font-medium text-ink">{r.TieuDe}</span> },
    { key: 'status', header: 'Trạng thái', align: 'center', cell: (r) => <StatusBadge domain="support" status={r.TrangThai} /> },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      cell: (r) => (
        <Link to={`/admin/support/${r.MaYeuCauHoTro}`} className="admin-row-link">
          <span>{r.TrangThai === 'Đã xử lý' ? 'Xem kết quả' : 'Xử lý'}</span>
          <Icon name="caret-right" size={14} />
        </Link>
      ),
    },
  ];

  return (
    <div className="admin-page-shell max-w-[1200px] mx-auto w-full">
      <PageHeader
        title="Hỗ trợ & khiếu nại"
        description="Ưu tiên ticket mới và đang xử lý; theo dõi rõ người xử lý, trạng thái và kết quả phản hồi."
      />

      <AdminListPanel
        itemLabel="yêu cầu"
        total={query.data?.pagination.total}
        activeFilterCount={activeFilterCount}
        onRefresh={() => void query.refetch()}
        refreshing={query.isFetching}
        filters={
          <FilterBar onReset={activeFilterCount > 0 ? reset : undefined}>
            <div role="group" aria-label="Lọc theo trạng thái yêu cầu" className="admin-quick-filters basis-full">
              <span>Trạng thái</span>
              {['ALL', ...STATUSES].map((st) => (
                <FilterChip
                  key={st}
                  pressed={status === st || (st === 'ALL' && !status)}
                  onClick={() => {
                    setValue('status', st);
                    setPage(1);
                  }}
                >
                  {st === 'ALL' ? 'Tất cả' : st}
                </FilterChip>
              ))}
            </div>
            <div className="min-w-[240px] flex-[2]">
              <Input
                label="Tìm yêu cầu"
                type="text"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                placeholder="Mã ticket, tiêu đề hoặc khách hàng..."
              />
            </div>
            <div className="min-w-[180px] flex-1">
              <Select
                label="Phân loại"
                value={type}
                onChange={(e) => {
                  setValue('type', e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả phân loại</option>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
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
          emptyDescription="Hãy thay đổi trạng thái, từ khóa hoặc phân loại."
          emptyIcon="chat-circle-dots"
          footer={
            query.data && (
              <Pagination
                page={page}
                totalPages={query.data.pagination.totalPages}
                total={query.data.pagination.total}
                itemLabel="yêu cầu"
                onPageChange={setPage}
              />
            )
          }
        />
      </AdminListPanel>
    </div>
  );
}
