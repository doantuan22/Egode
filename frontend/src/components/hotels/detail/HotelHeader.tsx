import { Link } from 'react-router-dom';
import type { HotelDetail } from '../../../features/hotels/types';
import { Button } from '../../common/Button';
import { Icon } from '../../common/Icon';
import { cn } from '../../../lib/utils';
import { formatRating } from '../../../features/reviews/rating';

/** Breadcrumb, hotel name, star rating, address and the share action. */
export function HotelHeader({ hotel, onShare }: { hotel: HotelDetail; onShare: () => void }) {
  return (
    <>
      <section className="bg-surface-secondary border-b border-border/80">
        <div className="page-container py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <nav aria-label="Đường dẫn" className="flex items-center gap-2 text-ink-muted overflow-x-auto py-1">
            <Link to="/" className="hover:text-primary font-medium transition-colors">Trang chủ</Link>
            <Icon name="caret-right" className="text-sm text-border-strong" />
            <Link to="/hotels" className="hover:text-primary font-medium transition-colors">Khách sạn</Link>
            <Icon name="caret-right" className="text-sm text-border-strong" />
            <span className="font-semibold text-ink truncate max-w-[200px] sm:max-w-none">{hotel.TenKhachSan}</span>
          </nav>
          <Button asChild variant="outline" size="sm">
            <Link to="/hotels"><Icon name="arrow-left" /><span>Quay lại kết quả tìm kiếm</span></Link>
          </Button>
        </div>
      </section>

      <section className="pt-6 pb-4 bg-surface">
        <div className="page-container flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="flex items-center text-warning gap-0.5" aria-hidden="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <Icon key={i} name="star" weight={i < hotel.HangSao ? 'fill' : 'regular'} className={cn('text-base', i >= hotel.HangSao && 'text-border-strong')} />
                ))}
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary-50 text-primary border border-primary-200">{hotel.HangSao} Sao</span>
              {(hotel.DanhGia?.SoLuongDanhGia ?? 0) > 0 && (
                <a href="#danh-gia-khach" className="text-xs font-semibold text-ink hover:text-primary">
                  {formatRating(hotel.DanhGia?.DiemTrungBinh ?? null)}/5 · {hotel.DanhGia?.SoLuongDanhGia} đánh giá
                </a>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-ink tracking-tight">{hotel.TenKhachSan}</h1>
            <p className="flex items-center flex-wrap gap-2 text-sm text-ink-muted mt-2">
              <Icon name="map-pin" className="text-base text-primary flex-shrink-0" />
              <span>{hotel.DiaChiChiTiet}</span>
            </p>
          </div>

          <Button type="button" variant="outline" aria-label="Chia sẻ" onClick={onShare} className="self-start lg:self-end">
            <Icon name="share-network" />
            <span className="hidden sm:inline">Chia sẻ</span>
          </Button>
        </div>
      </section>
    </>
  );
}
