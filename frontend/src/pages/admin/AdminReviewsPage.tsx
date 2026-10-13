import { Link } from 'react-router-dom';
import { useAdminReviewList, useRemoveViolationReview } from '../../features/reviews/hooks';
import { ApiError } from '../../services/apiClient';
import { useConfirm, useToast } from '../../components/common/FeedbackProvider';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { useListParams, useUrlSearchInput } from '../../hooks/useListParams';
import { Pagination } from '../../components/common/Pagination';
import { PageHeader } from '../../components/common/PageHeader';
import { FilterBar } from '../../components/common/FilterBar';
import { DataTable, type Column } from '../../components/common/DataTable';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import type { AdminReviewListItem } from '../../features/reviews/types';
import { Icon } from '../../components/common/Icon';
import { AdminListPanel } from '../../components/admin/AdminListPanel';

const PAGE_SIZE = 10;
// Reviews are published as soon as they are posted; 'Chờ duyệt' only exists on rows written before that change.
const STATUSES = ['Hiển thị', 'Ẩn', 'Vi phạm'];

const FILTER_DEFAULTS = { search: '', status: '', star: '' };

export default function AdminReviewsPage() {
  const { values, page, setValue, setPage, reset } = useListParams(FILTER_DEFAULTS);
  const [searchInput, setSearchInput] = useUrlSearchInput(values.search, (value) => setValue('search', value));
  const search = values.search;
  const status = values.status;
  const setStatus = (value: string) => setValue('status', value);
  const star = values.star;
  const setStar = (value: string) => setValue('star', value);
  // Older shared URLs used ALL explicitly; normalize them to the current empty/default value.
  const selectedStatus = status === 'ALL' ? '' : status;
  const selectedStar = star === 'ALL' ? '' : star;

  const query = useAdminReviewList({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    trangThai: selectedStatus || undefined,
    diemDanhGia: selectedStar ? Number(selectedStar) : undefined,
  });
  const removeMutation = useRemoveViolationReview();
  const confirm = useConfirm();
  const notify = useToast();
  const removeReview = (id: number) =>
    removeMutation.mutate(id, {
      onSuccess: () => notify({ title: 'Đã gỡ đánh giá', description: 'Đánh giá đã được gỡ khỏi phần hiển thị công khai; dữ liệu lịch sử vẫn được lưu.', tone: 'success', duration: 7000 }),
      onError: (error) => notify({ title: 'Không gỡ được đánh giá', description: error instanceof ApiError ? error.message : 'Thao tác thất bại, vui lòng thử lại.', tone: 'error' }),
    });

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    setPage(1);
  };

  const visibleReviews = query.data?.items
    // The star filter is also applied locally so a stale cached page never shows the wrong score.
    .filter((r) => !selectedStar || r.DiemDanhGia.toString() === selectedStar);

  const activeFilterCount = Number(Boolean(search)) + Number(Boolean(selectedStatus)) + Number(Boolean(selectedStar));

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
              onClick={() => { void confirm({ title: 'Gỡ đánh giá khỏi phần công khai?', description: 'Dữ liệu và ảnh vẫn được lưu để phục vụ kiểm tra.', confirmLabel: 'Gỡ đánh giá', variant: 'danger' }).then((accepted) => { if (accepted) removeReview(r.MaDanhGia); }); }}
            >
              Xóa/gỡ
            </Button>
          )}
          <Link to={`/admin/reviews/${r.MaDanhGia}`} className="admin-row-link"><span>Chi tiết</span><Icon name="caret-right" size={14} /></Link>
        </div>
      ),
    },
  ];

  const resetFilters = () => {
    setSearchInput('');
    reset();
  };

  return (
    <div className="admin-page-shell max-w-[1200px] mx-auto w-full">
      <PageHeader title="Kiểm duyệt đánh giá" description="Rà soát phản hồi từ du khách, xử lý báo cáo vi phạm nội dung không chuẩn mực." />

<AdminListPanel
        itemLabel="đánh giá"
        total={query.data?.pagination.total}
        activeFilterCount={activeFilterCount}
        onRefresh={() => void query.refetch()}
        refreshing={query.isFetching}
        filters={
          <FilterBar>
            <div className="admin-review-filters__fields basis-full">
              <div className="admin-review-filters__search">
                <Input
                  label="Tìm kiếm"
                  type="search"
                  value={searchInput}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Tên khách sạn, khách hàng hoặc nội dung đánh giá..."
                />
              </div>
              <div className="admin-review-filters__status-select">
                <Select label="Trạng thái kiểm duyệt" value={selectedStatus} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                  <option value="">Tất cả trạng thái</option>
                  {STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
                </Select>
              </div>
              <div className="admin-review-filters__rating">
                <Select label="Điểm đánh giá" value={selectedStar} onChange={(e) => { setStar(e.target.value); setPage(1); }}>
                  <option value="">Tất cả mức điểm</option>
                  <option value="1">1 sao (Kém)</option>
                  <option value="2">2 sao</option>
                  <option value="3">3 sao</option>
                  <option value="4">4 sao</option>
                  <option value="5">5 sao (Tốt)</option>
                </Select>
              </div>
            </div>

            {activeFilterCount > 0 && (
              <div className="admin-active-filters admin-review-filters__active basis-full" aria-label="Bộ lọc đang dùng">
                <span className="admin-review-filters__active-label">Đang lọc:</span>
                {search && (
                  <button type="button" aria-label={`Bỏ từ khóa ${search}`} onClick={() => { setSearchInput(''); setPage(1); }} title={`Bỏ từ khóa ${search}`}>
                    Từ khóa: <span className="admin-review-filters__active-value">{search}</span> <span aria-hidden="true">×</span>
                  </button>
                )}
                {selectedStar && (
                  <button type="button" aria-label={`Bỏ bộ lọc ${selectedStar} sao`} onClick={() => { setStar(''); setPage(1); }}>
                    Điểm: {selectedStar} sao <span aria-hidden="true">×</span>
                  </button>
                )}
                {selectedStatus && (
                  <button type="button" aria-label={`Bỏ bộ lọc trạng thái ${selectedStatus}`} onClick={() => { setStatus(''); setPage(1); }}>
                    Trạng thái: {selectedStatus} <span aria-hidden="true">×</span>
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
      </AdminListPanel>
    </div>
  );
}
