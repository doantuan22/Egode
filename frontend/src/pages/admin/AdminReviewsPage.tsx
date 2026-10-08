import { Link } from 'react-router-dom';
import { useAdminReviewList, useRemoveViolationReview } from '../../features/reviews/hooks';
import { ApiError } from '../../services/apiClient';
import { useConfirm } from '../../components/common/FeedbackProvider';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { useListParams, useUrlSearchInput } from '../../hooks/useListParams';
import { Pagination } from '../../components/common/Pagination';
import { PageHeader } from '../../components/common/PageHeader';
import { FilterBar } from '../../components/common/FilterBar';
import { FilterChip } from '../../components/common/FilterChip';
import { DataTable, type Column } from '../../components/common/DataTable';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Alert } from '../../components/common/Alert';
import type { AdminReviewListItem } from '../../features/reviews/types';

const PAGE_SIZE = 10;
const STATUSES = ['Chờ duyệt', 'Hiển thị', 'Ẩn', 'Vi phạm'];

const FILTER_DEFAULTS = { search: '', status: '', star: '' };

export default function AdminReviewsPage() {
  const { values, page, setValue, setPage, reset } = useListParams(FILTER_DEFAULTS);
  const [searchInput, setSearchInput] = useUrlSearchInput(values.search, (value) => setValue('search', value));
  const search = values.search;
  const status = values.status;
  const setStatus = (value: string) => setValue('status', value);
  const star = values.star;
  const setStar = (value: string) => setValue('star', value);

  const query = useAdminReviewList({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    trangThai: status === 'ALL' ? undefined : status || undefined,
    diemDanhGia: star && star !== 'ALL' ? Number(star) : undefined,
  });
  const removeMutation = useRemoveViolationReview();
  const confirm = useConfirm();

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    setPage(1);
  };

  const visibleReviews = query.data?.items
    // The star filter is also applied locally so a stale cached page never shows the wrong score.
    .filter((r) => star === 'ALL' || star === '' || r.DiemDanhGia.toString() === star);

  const columns: Column<AdminReviewListItem>[] = [
    {
      key: 'score',
      header: 'Điểm sao',
      align: 'center',
      cell: (r) => (
        <>
          <span role="img" aria-label={`${r.DiemDanhGia} trên 5 sao`} className="text-sm tracking-tighter">
            {[1, 2, 3, 4, 5].map((i) => <span key={i} aria-hidden="true" className={i <= r.DiemDanhGia ? 'text-warning' : 'text-border-strong'}>★</span>)}
          </span>
          <div className="mt-1 text-[10px] text-ink-muted">{r.DiemDanhGia}.0 / 5</div>
        </>
      ),
    },
    { key: 'customer', header: 'Khách hàng', cell: (r) => <span className="font-bold text-heading">{r.TAI_KHOAN.HoTen}</span> },
    { key: 'hotel', header: 'Cơ sở khách sạn', cell: (r) => <span className="font-medium text-ink-sub">{r.KHACH_SAN.TenKhachSan}</span> },
    { key: 'status', header: 'Trạng thái', align: 'center', cell: (r) => <StatusBadge domain="review" status={r.TrangThai} /> },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      cell: (r) => (
        <div className="flex items-center justify-center gap-3">
          {r.TrangThai === 'Vi phạm' && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={removeMutation.isPending}
              onClick={() => { void confirm({ title: 'Gỡ đánh giá khỏi phần công khai?', description: 'Dữ liệu và ảnh vẫn được lưu để phục vụ kiểm tra.', confirmLabel: 'Gỡ đánh giá', variant: 'danger' }).then((accepted) => { if (accepted) removeMutation.mutate(r.MaDanhGia); }); }}
            >
              Xóa/gỡ
            </Button>
          )}
          <Link to={`/admin/reviews/${r.MaDanhGia}`} className="admin-row-link">Chi tiết</Link>
        </div>
      ),
    },
  ];

  const resetFilters = () => reset();

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto w-full">
      <PageHeader title="Kiểm duyệt đánh giá" description="Rà soát phản hồi từ du khách, xử lý báo cáo vi phạm nội dung không chuẩn mực." />

      <FilterBar onReset={resetFilters}>
        <div role="group" aria-label="Lọc theo trạng thái đánh giá" className="flex basis-full gap-2 overflow-x-auto">
          {['ALL', ...STATUSES].map((st) => (
            <FilterChip key={st} pressed={status === st || (st === 'ALL' && !status)} onClick={() => { setStatus(st); setPage(1); }}>
              {st === 'ALL' ? 'Tất cả đánh giá' : st}
            </FilterChip>
          ))}
        </div>
        <div className="min-w-[240px] flex-[2]">
          <Input
            label="Tìm kiếm đánh giá"
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Tìm kiếm đánh giá theo tên khách sạn, tên người dùng..."
          />
        </div>
        <div className="min-w-[180px] flex-1">
          <Select label="Hạng sao" value={star} onChange={(e) => { setStar(e.target.value); setPage(1); }}>
            <option value="ALL">Tất cả điểm sao</option>
            <option value="1">1 sao (Kém)</option>
            <option value="2">2 sao</option>
            <option value="3">3 sao</option>
            <option value="4">4 sao</option>
            <option value="5">5 sao (Tốt)</option>
          </Select>
        </div>
      </FilterBar>

      {removeMutation.isError && (
        <Alert tone="error">{removeMutation.error instanceof ApiError ? removeMutation.error.message : 'Không thể gỡ đánh giá'}</Alert>
      )}
      {removeMutation.isSuccess && (
        <Alert tone="success">Đánh giá đã được gỡ khỏi phần hiển thị công khai; dữ liệu lịch sử vẫn được lưu.</Alert>
      )}

      <DataTable
        caption="Danh sách đánh giá"
        columns={columns}
        rows={visibleReviews}
        getRowKey={(r) => r.MaDanhGia}
        isLoading={query.isLoading}
        error={query.isError ? (query.error instanceof ApiError ? query.error.message : 'Không thể tải danh sách đánh giá') : null}
        emptyTitle="Không tìm thấy đánh giá nào"
        emptyDescription="Chưa có đánh giá nào phù hợp với bộ lọc."
        emptyIcon="star"
        footer={query.data && (
          <Pagination page={page} totalPages={query.data.pagination.totalPages} total={query.data.pagination.total} itemLabel="đánh giá" onPageChange={setPage} />
        )}
      />
    </div>
  );
}
