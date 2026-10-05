import { useState } from 'react';
import { useHotelReviews } from '../../../features/reviews/hooks';
import { ApiError } from '../../../services/apiClient';
import { Card } from '../../common/Card';
import { Icon } from '../../common/Icon';
import { PageSpinner } from '../../common/PageSpinner';
import { Pagination } from '../../common/Pagination';
import { formatRating } from '../../../features/reviews/rating';

const PAGE_SIZE = 5;

/** "Đánh giá": the visible reviews of the hotel (public: guests see them too), a page at a time. */
export function HotelReviews({ hotelId }: { hotelId: number }) {
  const [page, setPage] = useState(1);
  const query = useHotelReviews(hotelId, page, PAGE_SIZE);
  const reviews = query.data;

  return (
    <section id="danh-gia-khach" className="pt-2 scroll-mt-36">
      <Card className="sm:p-8">
        <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight mb-4 flex items-center gap-2.5">
          <Icon name="star" size={24} className="text-primary" />
          Đánh giá của khách
        </h2>

        {query.isLoading ? (
          <PageSpinner className="py-6" />
        ) : query.isError || !reviews ? (
          <p role="alert" className="text-sm text-danger-ink">
            {query.error instanceof ApiError ? query.error.message : 'Không thể tải đánh giá.'}
          </p>
        ) : reviews.pagination.total === 0 ? (
          <p className="text-sm text-ink-muted">Chưa có đánh giá nào cho khách sạn này.</p>
        ) : (
          <>
            <p className="mb-4 flex items-baseline gap-2 text-sm text-ink-muted">
              <strong className="text-2xl text-ink">{formatRating(reviews.summary.DiemTrungBinh)}</strong>
              <span>/ 5 · {reviews.summary.SoLuongDanhGia} đánh giá</span>
            </p>
            <ul className="divide-y divide-border">
              {reviews.items.map((review) => (
                <li key={review.MaDanhGia} className="py-4">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm text-ink">{review.TenNguoiDanhGia}</strong>
                    <span className="text-warning" role="img" aria-label={`${review.DiemDanhGia} trên 5 sao`}>
                      {'★'.repeat(review.DiemDanhGia)}
                      <span className="text-border-strong">{'★'.repeat(5 - review.DiemDanhGia)}</span>
                    </span>
                  </div>
                  {review.NoiDung && <p className="mt-2 whitespace-pre-line text-sm text-ink-muted">{review.NoiDung}</p>}
                  {review.HinhAnh.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {review.HinhAnh.map((url) => (
                        <img key={url} src={url} alt="" loading="lazy" className="h-16 w-16 rounded-lg object-cover" />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {reviews.pagination.totalPages > 1 && (
              <Pagination page={page} totalPages={reviews.pagination.totalPages} total={reviews.pagination.total} itemLabel="đánh giá" onPageChange={setPage} />
            )}
          </>
        )}
      </Card>
    </section>
  );
}
