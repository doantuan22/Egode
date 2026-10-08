import { Link } from 'react-router-dom';
import { usePromotionList } from '../../features/promotions/hooks';
import { formatCurrencyVND, formatDateVi } from '../../lib/utils';
import { ApiError } from '../../services/apiClient';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { useListParams, useUrlSearchInput } from '../../hooks/useListParams';
import { Pagination } from '../../components/common/Pagination';
import { PageHeader } from '../../components/common/PageHeader';
import { FilterBar } from '../../components/common/FilterBar';
import { DataTable, type Column } from '../../components/common/DataTable';
import { Button } from '../../components/common/Button';
import { Icon } from '../../components/common/Icon';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import type { Promotion } from '../../features/promotions/types';
import { AdminListPanel } from '../../components/admin/AdminListPanel';

const PAGE_SIZE = 10;
const STATUSES = ['Hoạt động', 'Ngừng'];
const TYPES = ['Phần trăm', 'Số tiền cố định'];

const FILTER_DEFAULTS = { search: '', status: '', type: '' };

export default function AdminPromotionsPage() {
  const { values, page, setValue, setPage, reset } = useListParams(FILTER_DEFAULTS);
  const [searchInput, setSearchInput] = useUrlSearchInput(values.search, (value) => setValue('search', value));
  const search = values.search;
  const status = values.status;
  const setStatus = (value: string) => setValue('status', value);
  const type = values.type;
  const setType = (value: string) => setValue('type', value);

  const query = usePromotionList({ page, limit: PAGE_SIZE, search: search || undefined, TrangThai: status || undefined, LoaiGiamGia: type || undefined });

  const resetFilters = () => reset();

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    setPage(1);
  };

  const activeFilterCount = Number(Boolean(search)) + Number(Boolean(status)) + Number(Boolean(type));

  const columns: Column<Promotion>[] = [
    { key: 'code', header: 'Mã code', cell: (p) => <span className="font-mono text-sm font-bold text-primary-600">{p.MaCode}</span> },
    { key: 'type', header: 'Loại giảm', cell: (p) => <span className="font-medium text-ink-sub">{p.LoaiGiamGia}</span> },
    { key: 'value', header: 'Giá trị giảm', align: 'right', cell: (p) => <span className="font-bold text-heading">{p.LoaiGiamGia === 'Phần trăm' ? `${p.GiaTriGiam}%` : formatCurrencyVND(p.GiaTriGiam)}</span> },
    { key: 'period', header: 'Thời gian áp dụng', align: 'center', cell: (p) => <span className="whitespace-nowrap text-xs text-ink-sub">{formatDateVi(p.NgayBatDau.slice(0, 10))} → {formatDateVi(p.NgayKetThuc.slice(0, 10))}</span> },
    { key: 'status', header: 'Trạng thái', align: 'center', cell: (p) => <StatusBadge domain="promotion" status={p.TrangThai} /> },
    { key: 'actions', header: 'Thao tác', align: 'center', cell: (p) => <Link to={`/admin/promotions/${p.MaKhuyenMai}`} className="admin-row-link"><span>Chi tiết</span><Icon name="caret-right" size={14} /></Link> },
  ];

  return (
    <div className="admin-page-shell max-w-[1200px] mx-auto w-full">
      <PageHeader
        title="Quản lý khuyến mãi"
        description="Thiết lập các mã voucher chiết khấu, chiến dịch giảm giá toàn sàn."
        actions={<Button asChild><Link to="/admin/promotions/new"><Icon name="plus" size={16} /><span>Tạo khuyến mãi mới</span></Link></Button>}
      />

      <AdminListPanel
        itemLabel="khuyến mãi"
        total={query.data?.pagination.total}
        activeFilterCount={activeFilterCount}
        onRefresh={() => void query.refetch()}
        refreshing={query.isFetching}
        filters={
          <FilterBar onReset={activeFilterCount > 0 ? resetFilters : undefined}>
            <div className="min-w-[240px] flex-[2]">
              <Input label="Tìm mã code / chương trình" type="text" value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Nhập mã voucher..." />
            </div>
            <div className="min-w-[180px] flex-1">
              <Select label="Trạng thái áp dụng" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">Tất cả trạng thái</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="min-w-[180px] flex-1">
              <Select label="Loại giảm giá" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
                <option value="">Tất cả loại giảm</option>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
          </FilterBar>
        }
      >
        <DataTable
          bare
          caption="Danh sách khuyến mãi"
          columns={columns}
          rows={query.data?.items}
          getRowKey={(p) => p.MaKhuyenMai}
          isLoading={query.isLoading}
          error={query.isError ? (query.error instanceof ApiError ? query.error.message : 'Không thể tải danh sách khuyến mãi') : null}
          emptyTitle="Không tìm thấy mã khuyến mãi nào"
          emptyDescription="Chưa có mã khuyến mãi nào phù hợp với bộ lọc."
          emptyIcon="ticket"
          footer={query.data && (
            <Pagination page={page} totalPages={query.data.pagination.totalPages} total={query.data.pagination.total} itemLabel="mã" onPageChange={setPage} />
          )}
        />
      </AdminListPanel>
    </div>
  );
}
