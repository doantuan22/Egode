import type { HotelDetail } from '../../../features/hotels/types';
import { Button } from '../../common/Button';
import { Icon } from '../../common/Icon';
import { cn } from '../../../lib/utils';

interface HotelGalleryProps {
  images: HotelDetail['HinhAnh'];
  hotelName: string;
  /** Mở trình xem ảnh tại vị trí index */
  onOpen: (index: number) => void;
}

/** Một ảnh lớn và tối đa bốn ảnh nhỏ */
export function HotelGallery({ images, hotelName, onOpen }: HotelGalleryProps) {
  return (
    <section className="py-4 bg-surface">
      <div className="page-container">
        {images.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-2xl overflow-hidden relative">
            <button type="button" aria-label="Xem ảnh lớn 1" onClick={() => onOpen(0)} className="md:col-span-2 relative group overflow-hidden cursor-pointer h-[20rem] md:h-[27.5rem]">
              <img
                src={images[0].URL}
                alt={hotelName}
                width={1280}
                height={880}
                fetchPriority="high"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
              />
            </button>
            <div className="hidden md:grid md:col-span-2 grid-cols-2 gap-3 h-[27.5rem]">
              {images.slice(1, 5).map((img, index) => {
                const showAll = index === 3 && images.length > 5;
                return (
                  <button
                    key={img.MaHinhAnh}
                    type="button"
                    aria-label={showAll ? `Xem tất cả ${images.length} ảnh` : `Xem ảnh lớn ${index + 2}`}
                    onClick={() => onOpen(index + 1)}
                    className="relative group overflow-hidden cursor-pointer rounded-lg"
                  >
                    <img
                      src={img.URL}
                      alt={`Ảnh ${index + 2}`}
                      width={640}
                      height={440}
                      loading="lazy"
                      decoding="async"
                      className={cn('w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out', showAll && 'brightness-90')}
                    />
                    {showAll && (
                      <span className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="bg-surface/95 text-ink font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2">
                          <Icon name="squares-four" className="text-base text-primary" />
                          <span aria-hidden="true">Xem tất cả {images.length} ảnh</span>
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {images.length > 1 && (
              // Lớp bọc ẩn trên màn hình lớn
              <div className="absolute bottom-3 right-3 md:hidden">
                <Button type="button" variant="secondary" size="sm" onClick={() => onOpen(0)}>
                  <Icon name="squares-four" /> Xem {images.length} ảnh
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-72 items-center justify-center rounded-2xl bg-surface-tertiary text-ink-muted">
            <Icon name="image" weight="duotone" size={36} className="mr-2" /> Chưa có hình ảnh
          </div>
        )}
      </div>
    </section>
  );
}
