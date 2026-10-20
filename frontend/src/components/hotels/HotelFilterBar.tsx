import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Amenity } from '../../features/hotels/types';
import { cn } from '../../lib/utils';
import { Icon } from '../common/Icon';
import { amenityIconName } from './amenityIcon';

export interface HotelFilterValues {
  keyword?: string;
  minPrice?: number;
  maxPrice?: number;
  starRating?: number;
  amenities?: number[];
}

interface HotelFilterBarProps {
  /** Bộ lọc hiện có trên URL */
  values: HotelFilterValues;
  amenities: Amenity[] | undefined;
  /** Số khách sạn kết quả hiện cạnh nút áp dụng */
  totalHotels?: number;
  /** Áp dụng cả bộ lọc cùng lúc */
  onApply: (next: HotelFilterValues) => void;
  onReset: () => void;
}

// Lọc sao là mức tối thiểu
const STARS = [3, 4, 5];
const PRICE_MAX = 10_000_000;
const PRICE_STEP = 100_000;
// Lưới tiện nghi thu gọn thành một hàng
const AMENITY_MIN_WIDTH = 184;
const AMENITY_GAP = 10;
const AMENITY_FALLBACK_COLUMNS = 6;
const PHONE_WIDTH = 520;
const PHONE_ROWS = 3;

const money = new Intl.NumberFormat('vi-VN');
const formatMoney = (value: number) => `${money.format(value)}đ`;
const digitsToNumber = (text: string) => {
  const digits = text.replace(/\D/g, '');
  return digits === '' ? undefined : Number(digits);
};

const sameIds = (a: number[] = [], b: number[] = []) => a.length === b.length && a.every((id) => b.includes(id));
const sameFilters = (a: HotelFilterValues, b: HotelFilterValues) =>
  (a.keyword ?? '') === (b.keyword ?? '') &&
  a.minPrice === b.minPrice &&
  a.maxPrice === b.maxPrice &&
  a.starRating === b.starRating &&
  sameIds(a.amenities, b.amenities);
const hasAny = (v: HotelFilterValues) =>
  Boolean(v.keyword) || v.minPrice !== undefined || v.maxPrice !== undefined || v.starRating !== undefined || (v.amenities?.length ?? 0) > 0;

/** Giá ở cực trị nghĩa là không giới hạn */
function normalize(draft: HotelFilterValues): HotelFilterValues {
  let minPrice = draft.minPrice && draft.minPrice > 0 ? draft.minPrice : undefined;
  let maxPrice = draft.maxPrice !== undefined && draft.maxPrice >= PRICE_MAX ? undefined : draft.maxPrice;
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice];
  return {
    keyword: draft.keyword?.trim() || undefined,
    minPrice,
    maxPrice,
    starRating: draft.starRating,
    amenities: draft.amenities && draft.amenities.length > 0 ? draft.amenities : undefined,
  };
}

function PriceInput({ id, prefix, label, value, onChange }: { id: string; prefix: string; label: string; value: number; onChange: (value: number | undefined) => void }) {
  // Ô nhập có thể trống khi gõ, khi rời ô thì về giá trị thật
  const [text, setText] = useState(() => money.format(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(money.format(value));
  }, [value]);

  return (
    <div className="hotel-filter__money">
      <label htmlFor={id} className="sr-only">{label}</label>
      <span aria-hidden="true" className="hotel-filter__money-prefix">{prefix}</span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; setText(money.format(value)); }}
        onChange={(e) => {
          const parsed = digitsToNumber(e.target.value);
          setText(parsed === undefined ? '' : money.format(parsed));
          onChange(parsed);
        }}
      />
    </div>
  );
}

/** Thẻ lọc trên kết quả, chỉnh bản nháp rồi áp dụng lên URL */
export function HotelFilterBar({ values, amenities, totalHotels, onApply, onReset }: HotelFilterBarProps) {
  const uid = useId();
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState<HotelFilterValues>(values);
  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(AMENITY_FALLBACK_COLUMNS);
  const [rows, setRows] = useState(1);
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const width = grid.clientWidth;
      if (width <= 0) return;
      setColumns(Math.max(2, Math.floor((width + AMENITY_GAP) / (AMENITY_MIN_WIDTH + AMENITY_GAP))));
      setRows(width < PHONE_WIDTH ? PHONE_ROWS : 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [open, amenities?.length]);

  // URL là nguồn dữ liệu chính của bộ lọc
  const appliedKey = JSON.stringify([values.keyword ?? '', values.minPrice, values.maxPrice, values.starRating, [...(values.amenities ?? [])].sort()]);
  useEffect(() => setDraft(values), [appliedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (next: Partial<HotelFilterValues>) => setDraft((current) => ({ ...current, ...next }));
  const dirty = !sameFilters(normalize(draft), values);
  const minValue = Math.min(draft.minPrice ?? 0, PRICE_MAX);
  const maxValue = Math.min(draft.maxPrice ?? PRICE_MAX, PRICE_MAX);

  const selected = draft.amenities ?? [];
  const totalAmenities = amenities?.length ?? 0;
  const capacity = columns * rows;
  const canFold = totalAmenities > capacity;
  const hiddenCount = showAllAmenities || !canFold ? 0 : totalAmenities - (capacity - 1);
  const visibleAmenities = showAllAmenities || !canFold ? amenities : amenities?.slice(0, capacity - 1);
  const toggleAmenity = (id: number) => patch({ amenities: selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id] });

  const apply = () => onApply(normalize(draft));
  const onKeywordKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      apply();
    }
  };

  // Chip mô tả bộ lọc đang áp dụng
  const chips: Array<{ key: string; label: string; remove: () => void }> = [];
  if (values.keyword) chips.push({ key: 'keyword', label: `“${values.keyword}”`, remove: () => onApply({ ...values, keyword: undefined }) });
  for (const id of values.amenities ?? []) {
    const amenity = amenities?.find((a) => a.MaTienNghi === id);
    if (amenity) chips.push({ key: `amenity-${id}`, label: amenity.TenTienNghi, remove: () => onApply({ ...values, amenities: (values.amenities ?? []).filter((item) => item !== id) }) });
  }
  if (values.starRating !== undefined) chips.push({ key: 'star', label: `Từ ${values.starRating} sao`, remove: () => onApply({ ...values, starRating: undefined }) });
  if (values.minPrice !== undefined || values.maxPrice !== undefined) {
    const from = formatMoney(values.minPrice ?? 0);
    const to = values.maxPrice === undefined ? `${formatMoney(PRICE_MAX)}+` : formatMoney(values.maxPrice);
    chips.push({ key: 'price', label: `Giá: ${from} – ${to}`, remove: () => onApply({ ...values, minPrice: undefined, maxPrice: undefined }) });
  }

  const bodyId = `${uid}-body`;
  return (
    <section aria-label="Bộ lọc tìm kiếm" className="hotel-filter">
      <header className="hotel-filter__header">
        <span className="hotel-filter__header-icon" aria-hidden="true"><Icon name="sliders-horizontal" /></span>
        <div className="hotel-filter__header-text">
          <h2>Bộ lọc tìm kiếm</h2>
          <p>Tùy chỉnh tiêu chí để tìm nơi lưu trú phù hợp nhất với bạn</p>
        </div>
        <button type="button" className="hotel-filter__collapse" aria-expanded={open} aria-controls={bodyId} aria-label={open ? 'Thu gọn bộ lọc' : 'Mở rộng bộ lọc'} onClick={() => setOpen((v) => !v)}>
          <Icon name={open ? 'caret-up' : 'caret-down'} />
        </button>
      </header>

      <div id={bodyId} hidden={!open}>
        <div className="hotel-filter__top">
          <div className="hotel-filter__cell">
            <div className="hotel-filter__cell-head">
              <label htmlFor={`${uid}-keyword`} className="hotel-filter__title"><Icon name="magnifying-glass" />Từ khóa</label>
              <span className="hotel-filter__hint">Tìm theo tên khách sạn, địa điểm, khu vực...</span>
            </div>
            <div className="hotel-filter__search">
              <Icon name="magnifying-glass" />
              <input
                id={`${uid}-keyword`}
                type="search"
                maxLength={100}
                placeholder="Nhập từ khóa tìm kiếm..."
                value={draft.keyword ?? ''}
                onChange={(e) => patch({ keyword: e.target.value })}
                onKeyDown={onKeywordKeyDown}
              />
            </div>
          </div>

          <div role="group" aria-labelledby={`${uid}-price`} className="hotel-filter__cell">
            <div className="hotel-filter__cell-head">
              <span id={`${uid}-price`} className="hotel-filter__title"><Icon name="coins" />Giá mỗi đêm (VND)</span>
              <span className="hotel-filter__hint">{formatMoney(minValue)} – {formatMoney(maxValue)}{maxValue >= PRICE_MAX ? '+' : ''}</span>
            </div>
            <div className="hotel-filter__range">
              <div className="hotel-filter__range-track" aria-hidden="true">
                <span style={{ left: `${(minValue / PRICE_MAX) * 100}%`, right: `${100 - (maxValue / PRICE_MAX) * 100}%` }} />
              </div>
              <input
                type="range"
                min={0}
                max={PRICE_MAX}
                step={PRICE_STEP}
                value={minValue}
                aria-label="Kéo chọn giá tối thiểu"
                onChange={(e) => patch({ minPrice: Math.min(Number(e.target.value), maxValue) })}
              />
              <input
                type="range"
                min={0}
                max={PRICE_MAX}
                step={PRICE_STEP}
                value={maxValue}
                aria-label="Kéo chọn giá tối đa"
                onChange={(e) => patch({ maxPrice: Math.max(Number(e.target.value), minValue) })}
              />
            </div>
            <div className="hotel-filter__money-row">
              <PriceInput id="hotel-list-min-price" prefix="Từ" label="Giá tối thiểu" value={minValue} onChange={(v) => patch({ minPrice: v })} />
              <PriceInput id="hotel-list-max-price" prefix="Đến" label="Giá tối đa" value={maxValue} onChange={(v) => patch({ maxPrice: v })} />
            </div>
          </div>

          <div role="group" aria-labelledby={`${uid}-stars`} className="hotel-filter__cell">
            <div className="hotel-filter__cell-head">
              <span id={`${uid}-stars`} className="hotel-filter__title"><Icon name="star" />Hạng sao tối thiểu</span>
              <span className="hotel-filter__hint">Chọn mức xếp hạng mong muốn</span>
            </div>
            <div className="hotel-filter__stars">
              <button type="button" aria-pressed={draft.starRating === undefined} onClick={() => patch({ starRating: undefined })}>Tất cả</button>
              {STARS.map((star) => (
                <button key={star} type="button" aria-pressed={draft.starRating === star} aria-label={`Từ ${star} sao trở lên`} onClick={() => patch({ starRating: draft.starRating === star ? undefined : star })}>
                  <Icon name="star" weight="fill" className="hotel-filter__star" />
                  <span aria-hidden="true">{star} trở lên</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {amenities && amenities.length > 0 && (
          <div role="group" aria-labelledby={`${uid}-amenities`} className="hotel-filter__amenities">
            <p id={`${uid}-amenities`} className="hotel-filter__title"><Icon name="armchair" />Tiện nghi</p>
            <div ref={gridRef} className="hotel-filter__amenity-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
              {visibleAmenities?.map((amenity) => {
                const on = selected.includes(amenity.MaTienNghi);
                return (
                  <button key={amenity.MaTienNghi} type="button" aria-pressed={on} className="hotel-filter__amenity" onClick={() => toggleAmenity(amenity.MaTienNghi)}>
                    <span className="hotel-filter__amenity-icon"><Icon name={amenityIconName(amenity)} /></span>
                    <span className="hotel-filter__amenity-name">{amenity.TenTienNghi}</span>
                    {on && <span className="hotel-filter__amenity-check" aria-hidden="true"><Icon name="check" weight="bold" /></span>}
                  </button>
                );
              })}
              {canFold && (
                <button type="button" className="hotel-filter__amenity hotel-filter__amenity--more" aria-expanded={showAllAmenities} onClick={() => setShowAllAmenities((v) => !v)}>
                  <span className="hotel-filter__amenity-icon"><Icon name="dots-three" weight="bold" /></span>
                  <span className="hotel-filter__amenity-name">{showAllAmenities ? 'Thu gọn' : `Xem thêm ${hiddenCount}`}</span>
                  <Icon name={showAllAmenities ? 'caret-up' : 'caret-right'} />
                </button>
              )}
            </div>
          </div>
        )}

        <footer className="hotel-filter__footer">
          <div className="hotel-filter__applied">
            <div className="hotel-filter__applied-head">
              <span>Bộ lọc đang áp dụng</span>
              {chips.length > 0 && (
                <button type="button" className="hotel-filter__clear" onClick={onReset}>
                  <Icon name="trash" />Xóa tất cả
                </button>
              )}
            </div>
            {chips.length > 0 ? (
              <ul className="hotel-filter__chips">
                {chips.map((chip) => (
                  <li key={chip.key}>
                    {chip.label}
                    <button type="button" aria-label={`Bỏ lọc ${chip.label}`} onClick={chip.remove}><Icon name="x" weight="bold" /></button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hotel-filter__none">Chưa chọn bộ lọc nào.</p>
            )}
          </div>

          <div className="hotel-filter__actions">
            {totalHotels !== undefined && (
              <p className="hotel-filter__found" aria-live="polite">Tìm thấy <strong>{totalHotels}</strong> khách sạn</p>
            )}
            <button type="button" className="hotel-filter__reset" disabled={!hasAny(values) && !hasAny(draft)} onClick={onReset}>
              <Icon name="arrow-counter-clockwise" />Đặt lại bộ lọc
            </button>
            <button type="button" className={cn('hotel-filter__apply', dirty && 'is-dirty')} disabled={!dirty} onClick={apply}>
              <Icon name="magnifying-glass" />Áp dụng bộ lọc
            </button>
          </div>
        </footer>
      </div>
    </section>
  );
}
