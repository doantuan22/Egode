import { Link } from 'react-router-dom';
import { useAdminReviewList } from '../../features/reviews/hooks';
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
import type { AdminReviewListItem } from '../../features/reviews/types';

const PAGE_SIZE = 10;
const STATUSES = ['Chờ duyệt', 'Hiển thị', 'Ẩn', 'Vi phạm'];
const FILTER_DEFAULTS = { search: '', status: '', star: '' };

export default function AdminReviewsPage() {
  const { values, page, setValue, setPage, reset } = useListParams(FILTER_DEFAULTS);
  const [searchInput, setSearchInput] = useUrlSearchInput(values.search, (value) => setValue('search', value));
  const search = values.search;
  const status = values.status;
  const star = values.star;

  const query = useAdminReviewList({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    trangThai: status === 'ALL' ? undefined : status || undefined,
    diemDanhGia: star && star !== 'ALL' ? Number(star) : undefined,
  });

  const activeFilterCount = Number(Boolean(search)) + Number(Boolean(status && status !== 'ALL')) + Number(Boolean(star && star !== 'ALL'));
  const visibleReviews = query.data?.items.filter((r) => star === 'ALL' || star === '' || r.DiemDanhGia.toString() === star);

  const columns: Column<AdminReviewListItem>[] = [
    {
      key: 'score',
      header: 'Điểm sao',
      align: 'center',
      cell: (r) => (
        <>
          <span role="img" aria-label={`${r.DiemDanhGia} trên 5 sao`} className="text-sm tracking-tighter">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} aria-hidden="true" className={i <= r.DiemDanhGia ? 'text-warning' : 'text-border-strong'}>
                ★
              </span>
            ))}
          </span>
          <div className="mt-1 text-[10px] text-ink-muted">{r.DiemDanhGia}.0 / 5</div>
        </>
      ),
    },
    { key: 'customer', header: 'Khách hàng', cell: (r) => <span className="font-bold text-heading">{r.TAI_KHOAN.HoTen}</span> },
    { key: 'hotel', header: 'Khách sạn', cell: (r) => <span className="font-medium text-ink-sub">{r.KHACH_SAN.TenKhachSan}</span> },
    { key: 'status', header: 'Trạng thái', align: 'center', cell: (r) => <StatusBadge domain="review" status={r.TrangThai} /> },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      cell: (r) => (
        <Link to={`/admin/reviews/${r.MaDanhGia}`} className="admin-row-link">
          <span>Kiểm duyệt</span>
          <Icon name="caret-right" size={14} />
        </Link>
      ),
    },
  ];

  return (
    <div className="admin-page-shell max-w-[1200px] mx-auto w-full">
      <PageHeader
        title="Kiểm duyệt đánh giá"
        description="Rà soát phản hồi của khách hàng; thao tác ẩn, đánh dấu vi phạm hoặc gỡ nội dung được thực hiện trong trang chi tiết."
      />

      <AdminListPanel
        itemLabel="đánh giá"
        total={query.data?.pagination.total}
        activeFilterCount={activeFilterCount}
        onRefresh={() => void query.refetch()}
        refreshing={query.isFetching}
        filters={
          <FilterBar onReset={activeFilterCount > 0 ? reset : undefined}>
            <div role="group" aria-label="Lọc theo trạng thái đánh giá" className="admin-quick-filters basis-full">
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
                label="Tìm kiếm"
                type="text"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                placeholder="Khách sạn hoặc người dùng..."
              />
            </div>
            <div className="min-w-[180px] flex-1">
              <Select
                label="Hạng sao"
                value={star}
                onChange={(e) => {
                  setValue('star', e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">Tất cả điểm sao</option>
                <option value="1">1 sao</option>
                <option value="2">2 sao</option>
                <option value="3">3 sao</option>
                <option value="4">4 sao</option>
                <option value="5">5 sao</option>
              </Select>
            </div>
          </FilterBar>
        }
      >
        <DataTable
          bare
          caption="Danh sách đánh giá"
          columns={columns}
          rows={visibleReviews}
          getRowKey={(r) => r.MaDanhGia}
          isLoading={query.isLoading}
          error={query.isError ? (query.error instanceof ApiError ? query.error.message : 'Không thể tải danh sách đánh giá') : null}
          emptyTitle="Không tìm thấy đánh giá nào"
          emptyDescription="Hãy thay đổi bộ lọc kiểm duyệt."
          emptyIcon="star"
          footer={
            query.data && (
              <Pagination
                page={page}
                totalPages={query.data.pagination.totalPages}
                total={query.data.pagination.total}
                itemLabel="đánh giá"
                onPageChange={setPage}
              />
            )
          }
        />
      </AdminListPanel>
    </div>
  );
}
