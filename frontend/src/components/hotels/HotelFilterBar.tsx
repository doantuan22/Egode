import { useState } from 'react';
import type { Amenity } from '../../features/hotels/types';
import { Button } from '../common/Button';
import { FilterChip } from '../common/FilterChip';
import { Icon } from '../common/Icon';

export interface HotelFilterValues {
  minPrice?: number;
  maxPrice?: number;
  starRating?: number;
  amenities?: number[];
}

interface HotelFilterBarProps {
  values: HotelFilterValues;
  amenities: Amenity[] | undefined;
  /** Commits one price bound (`undefined` clears it). Called on blur / Enter, not on every keystroke. */
  onPriceChange: (key: 'minPrice' | 'maxPrice', value: string | undefined) => void;
  onStarChange: (star: number | undefined) => void;
  onAmenityToggle: (id: number) => void;
  onReset: () => void;
}

// The filter is a MINIMUM ("starRating=N" lists hotels with HangSao >= N), so these are "Từ N sao trở lên".
const STARS = [3, 4, 5];

function PriceField({ id, label, value, placeholder, onCommit }: { id: string; label: string; value: number | undefined; placeholder: string; onCommit: (value: string | undefined) => void }) {
  return (
    <div className="hotel-filter-bar__price">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        key={`${id}-${value ?? ''}`}
        type="number"
        min={0}
        inputMode="numeric"
        placeholder={placeholder}
        defaultValue={value}
        onBlur={(e) => onCommit(e.target.value || undefined)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
    </div>
  );
}

const AMENITIES_COLLAPSED = 8;

/** Horizontal quick filters above the results (a vertical sidebar pushes the results down on mobile). State stays in the URL: the page owns it. */
export function HotelFilterBar({ values, amenities, onPriceChange, onStarChange, onAmenityToggle, onReset }: HotelFilterBarProps) {
  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const hasFilters = values.minPrice !== undefined || values.maxPrice !== undefined || values.starRating !== undefined || (values.amenities?.length ?? 0) > 0;
  const hiddenCount = Math.max(0, (amenities?.length ?? 0) - AMENITIES_COLLAPSED);
  // A ticked amenity is never hidden behind "Xem thêm".
  const visibleAmenities = showAllAmenities ? amenities : amenities?.filter((a, i) => i < AMENITIES_COLLAPSED || (values.amenities ?? []).includes(a.MaTienNghi));

  return (
    <section aria-label="Bộ lọc tìm kiếm" className="hotel-filter-bar">
      <div className="hotel-filter-bar__row">
        <div role="group" aria-labelledby="hotel-filter-price" className="hotel-filter-bar__group">
          <p id="hotel-filter-price" className="hotel-filter-bar__label">Giá mỗi đêm (VND)</p>
          <div className="hotel-filter-bar__prices">
            <PriceField id="hotel-list-min-price" label="Giá tối thiểu" value={values.minPrice} placeholder="Từ" onCommit={(v) => onPriceChange('minPrice', v)} />
            <span aria-hidden="true">–</span>
            <PriceField id="hotel-list-max-price" label="Giá tối đa" value={values.maxPrice} placeholder="Đến" onCommit={(v) => onPriceChange('maxPrice', v)} />
          </div>
        </div>

        <div role="group" aria-labelledby="hotel-filter-stars" className="hotel-filter-bar__group">
          <p id="hotel-filter-stars" className="hotel-filter-bar__label">Hạng sao tối thiểu</p>
          <div className="hotel-filter-bar__chips">
            {STARS.map((star) => (
              <FilterChip key={star} pressed={values.starRating === star} onClick={() => onStarChange(values.starRating === star ? undefined : star)}>
                <span className="inline-flex items-center gap-1">Từ {star} <Icon name="star" weight="fill" className="text-warning" /><span className="sr-only">sao</span> trở lên</span>
              </FilterChip>
            ))}
          </div>
        </div>

        {hasFilters && (
          <div className="hotel-filter-bar__reset">
            <Button type="button" variant="ghost" size="sm" onClick={onReset}>
              <Icon name="arrow-counter-clockwise" /> Đặt lại
            </Button>
          </div>
        )}
      </div>

      {amenities && amenities.length > 0 && (
        <div role="group" aria-labelledby="hotel-filter-amenities" className="hotel-filter-bar__group hotel-filter-bar__amenities">
          <p id="hotel-filter-amenities" className="hotel-filter-bar__label">Tiện nghi</p>
          <div className="hotel-filter-bar__chips">
            {visibleAmenities?.map((amenity) => (
              <FilterChip key={amenity.MaTienNghi} pressed={(values.amenities ?? []).includes(amenity.MaTienNghi)} onClick={() => onAmenityToggle(amenity.MaTienNghi)}>
                {amenity.TenTienNghi}
              </FilterChip>
            ))}
            {hiddenCount > 0 && (
              <Button type="button" variant="ghost" size="sm" aria-expanded={showAllAmenities} onClick={() => setShowAllAmenities((open) => !open)}>
                {showAllAmenities ? 'Thu gọn' : `Xem thêm ${hiddenCount}`}
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
