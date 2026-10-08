import { Link, useParams } from 'react-router-dom';
import { useMyHotel, useOwnerHotelReviews } from '../../features/owner/hooks';
import type { ScoreDistribution } from '../../features/owner/types';
import { formatRating } from '../../features/reviews/rating';
import { useListParams } from '../../hooks/useListParams';
import { formatDateVi } from '../../lib/utils';
import { ApiError } from '../../services/apiClient';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { FilterChip } from '../../components/common/FilterChip';
import { PageHeader } from '../../components/common/PageHeader';
import { PageSpinner } from '../../components/common/PageSpinner';
import { Pagination } from '../../components/common/Pagination';

const PAGE_SIZE = 10;
const STARS = [5, 4, 3, 2, 1] as const;
const FILTER_DEFAULTS = { rating: '' };

const parseRating = (value: string): number | undefined => {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : undefined;
};

function Stars({ score }: { score: number }) {
  return (
    <span className="text-warning" role="img" aria-label={`${score} trên 5 sao`}>
      {'★'.repeat(score)}
      <span className="text-border-strong">{'★'.repeat(5 - score)}</span>
    </span>
  );
}

function DistributionBars({ distribution, total }: { distribution: ScoreDistribution; total: number }) {
  return (
    <ul className="grid gap-1.5" aria-label="Phân bố điểm đánh giá">
      {STARS.map((star) => {
        const count = distribution[star];
        return (
          <li key={star} className="flex items-center gap-3 text-sm">
            <span className="w-12 shrink-0 text-ink-sub">{star} sao</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-tertiary" aria-hidden="true">
              <span className="block h-full rounded-full bg-warning" style={{ width: total ? `${(count / total) * 100}%` : '0%' }} />
            </span>
            <span className="w-8 shrink-0 text-right tabular-nums text-ink-muted">{count}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** "Đánh giá của khách": what guests wrote about one of the owner's hotels (read-only; moderation is the administrator's). */
export default function OwnerHotelReviewsPage() {
  const hotelId = Number(useParams<{ hotelId: string }>().hotelId);
  const { values, page, setValue, setPage } = useListParams(FILTER_DEFAULTS);
  const rating = parseRating(values.rating);
  const setRating = (next: number | undefined) => {
    setValue('rating', next ? String(next) : '');
    setPage(1);
  };

  const hotelQuery = useMyHotel(hotelId);
  const reviewsQuery = useOwnerHotelReviews(hotelId, page, PAGE_SIZE, rating);

  if (hotelQuery.isLoading) return <PageSpinner />;
  if (hotelQuery.isError || !hotelQuery.data) {
    return (
      <div role="alert" className="mx-auto max-w-md rounded-lg border border-danger/30 bg-danger-light px-4 py-3 text-center text-sm text-danger-ink">
        {hotelQuery.error instanceof ApiError ? hotelQuery.error.message : 'Không tìm thấy khách sạn'}
      </div>
    );
  }

  const hotel = hotelQuery.data;
  const reviews = reviewsQuery.data;

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
      <Link to={`/owner/hotels/${hotelId}`} className="breadcrumb w-fit">
        <i className="ph ph-arrow-left" aria-hidden="true"></i>
        <span>Quay lại {hotel.TenKhachSan}</span>
      </Link>

      <PageHeader title="Đánh giá của khách" description={`Những gì khách đã viết về ${hotel.TenKhachSan}. Chỉ hiển thị các đánh giá đã được kiểm duyệt.`} />

      {reviewsQuery.isLoading ? (
        <PageSpinner />
      ) : reviewsQuery.isError || !reviews ? (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger-ink">
          {reviewsQuery.error instanceof ApiError ? reviewsQuery.error.message : 'Không thể tải đánh giá'}
        </div>
      ) : (
        <>
          <Card className="grid gap-6 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-center">
            <div>
              <p className="flex items-baseline gap-2">
                <strong className="text-4xl text-ink">{formatRating(reviews.summary.DiemTrungBinh)}</strong>
                <span className="text-sm text-ink-muted">/ 5</span>
              </p>
              <p className="mt-1 text-sm text-ink-muted">{reviews.summary.SoLuongDanhGia.toLocaleString('vi-VN')} đánh giá</p>
            </div>
            <DistributionBars distribution={reviews.summary.PhanBoDiem} total={reviews.summary.SoLuongDanhGia} />
          </Card>

          <div role="group" aria-label="Lọc theo số sao" className="flex gap-2 overflow-x-auto">
            <FilterChip pressed={rating === undefined} onClick={() => setRating(undefined)}>Tất cả</FilterChip>
            {STARS.map((star) => (
              <FilterChip key={star} pressed={rating === star} onClick={() => setRating(star)}>
                {star} sao ({reviews.summary.PhanBoDiem[star]})
              </FilterChip>
            ))}
          </div>

          {reviews.items.length === 0 ? (
            <EmptyState
              icon="chat-text"
              title={rating ? `Chưa có đánh giá ${rating} sao` : 'Chưa có đánh giá nào'}
              description={rating ? 'Thử chọn mức sao khác hoặc xem tất cả đánh giá.' : 'Đánh giá của khách sẽ xuất hiện ở đây sau khi được kiểm duyệt.'}
            />
          ) : (
            <Card padded={false}>
              <ul className="divide-y divide-border">
                {reviews.items.map((review) => (
                  <li key={review.MaDanhGia} className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-sm text-ink">{review.TenNguoiDanhGia}</strong>
                      <Stars score={review.DiemDanhGia} />
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Lưu trú {formatDateVi(review.NgayNhanPhong)} – {formatDateVi(review.NgayTraPhong)}
                    </p>
                    {review.NoiDung ? (
                      <p className="mt-2 whitespace-pre-line text-sm text-ink-sub">{review.NoiDung}</p>
                    ) : (
                      <p className="mt-2 text-sm italic text-ink-muted">Khách chỉ chấm điểm, không viết nhận xét.</p>
                    )}
                    {review.HinhAnh.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {review.HinhAnh.map((url) => (
                          <a key={url} href={url} target="_blank" rel="noreferrer" aria-label="Xem ảnh đánh giá">
                            <img src={url} alt="" loading="lazy" className="h-16 w-16 rounded-lg object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {reviews.pagination.totalPages > 1 && (
                <div className="border-t border-border p-4">
                  <Pagination page={page} totalPages={reviews.pagination.totalPages} total={reviews.pagination.total} itemLabel="đánh giá" onPageChange={setPage} />
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
