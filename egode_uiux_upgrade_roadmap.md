# Lộ Trình & Đặc Tả Kỹ Thuật Nâng Cấp Giao Diện UI/UX Hệ Thống Đặt Phòng Egode

Tài liệu này cung cấp kế hoạch thực thi chi tiết theo **3 giai đoạn** nhằm giải quyết triệt để các điểm nghẽn trải nghiệm người dùng (UX) và nợ kỹ thuật giao diện (UI) trong mã nguồn `frontend/src/` của dự án **Egode**. Toàn bộ giải pháp được đối chiếu với chuẩn thực nghiệm ngành lưu trú ([Baymard Institute Travel Accommodations UX](https://www.google.com/search?q=https%3A%2F%2Fbaymard.com%2Fresearch-articles%2Fnew-research-travel-accommodations), [Baymard Split-View Layout](https://www.google.com/search?q=https%3A%2F%2Fbaymard.com%2Fresearch-articles%2Faccommodations-split-view)) và các chuẩn Web Platform hiện đại ([W3C WCAG 2.2](https://www.google.com/search?q=https%3A%2F%2Fwww.w3.org%2FTR%2FWCAG22%2F), [WAI-ARIA APG Grid Pattern](https://www.google.com/search?q=https%3A%2F%2Fwww.w3.org%2FWAI%2FARIA%2Fapg%2Fpatterns%2Fgrid%2F), [MDN CSS Container Queries](https://www.google.com/search?q=https%3A%2F%2Fdeveloper.mozilla.org%2Fen-US%2Fdocs%2FWeb%2FCSS%2FGuides%2FContainment%2FContainer_queries), [MDN Popover API](https://www.google.com/search?q=https%3A%2F%2Fdeveloper.mozilla.org%2Fen-US%2Fdocs%2FWeb%2FAPI%2FPopover_API), [MDN CSS Anchor Positioning](https://www.google.com/search?q=https%3A%2F%2Fdeveloper.mozilla.org%2Fen-US%2Fdocs%2FWeb%2FCSS%2FGuides%2FAnchor_positioning)).

## Tổng Quan Kiến Trúc 3 Giai Đoạn Nâng Cấp

| Giai đoạn | Trọng tâm cải tiến | Thời lượng dự kiến | Các file chính cần can thiệp trong `frontend/src/` | Kết quả đầu ra cốt lõi |
| :--- | :--- | :--- | :--- | :--- |
| **Giai đoạn 1: Quick Wins & Khắc phục đứt gãy tương tác** | Sửa lỗi đóng Popover khi cuộn, chống che khuất Focus bàn phím, nâng cấp Lịch 2 tháng, thêm Hover Preview cho lịch Owner, đẩy kết quả tìm kiếm lên màn hình đầu | 1 – 2 ngày | `components/common/useAnchoredPosition.ts`, `assets/css/base.css`, `components/common/DateRangePicker.tsx`, `components/owner/InventoryCalendar.tsx`, `pages/public/HotelListPage.tsx` | Không còn lỗi mất menu khi lăn chuột; đạt chuẩn [WCAG 2.2 SC 2.4.11](https://www.google.com/search?q=https%3A%2F%2Fwww.w3.org%2FWAI%2FWCAG22%2FUnderstanding%2Ffocus-not-obscured-minimum.html); giảm 60% chiều cao thừa đầu trang tìm kiếm |
| **Giai đoạn 2: Tối ưu chuyển đổi Đặt phòng & Tìm kiếm tức thời** | Biến thanh tóm tắt Mobile thành Bottom Sheet, thêm bước xác nhận trước khi khóa phòng, làm giàu thông tin `HotelCard`, lọc trực tiếp có Debounce | 3 – 5 ngày | `components/hotels/detail/MobileBookingBar.tsx`, `components/hotels/detail/BookingPanel.tsx`, `pages/public/HotelDetailPage.tsx`, `components/hotels/HotelCard.tsx`, `components/hotels/HotelFilterBar.tsx` | Tăng tỷ lệ hoàn tất đặt phòng trên di động; minh bạch tổng giá kỳ lưu trú và địa chỉ chi tiết ngay trên thẻ kết quả |
| **Giai đoạn 3: Hiện đại hóa Vận hành (PMS/Admin) & Dọn nợ CSS** | Xây dựng Ma trận Đa loại phòng (Tape Chart) cho Owner, bố cục Split-View (Danh sách + Bản đồ), bảng dữ liệu thích ứng bằng `@container` và chuẩn hóa Design Tokens | 1 – 2 tuần | `pages/owner/OwnerInventoryPricingPage.tsx`, `components/owner/MultiRoomRateMatrix.tsx`, `pages/public/HotelListPage.tsx`, `components/common/DataTable.tsx`, `assets/css/variables.css`, `assets/css/components.css` | Giảm 70% thao tác cập nhật giá của chủ khách sạn; loại bỏ cuộn ngang bảng trên mobile; xóa bỏ mã màu Hex cứng và kích thước tùy ý |


## Giai Đoạn 1: Sửa Ngay Các Điểm Đứt Gãy Tương Tác & Quick Wins

### 1.1. Mục tiêu cần đạt được
* **Giữ nguyên Popover khi người dùng cuộn trang:** Ngăn chặn tình trạng đang mở danh sách chọn (`SelectMenu`, `Combobox`) mà vô tình chạm touchpad cuộn trang làm đóng mất popup.
* **Đảm bảo tiêu chí [WCAG 2.2 SC 2.4.11 Focus Not Obscured (Minimum)](https://www.google.com/search?q=https%3A%2F%2Fwww.w3.org%2FWAI%2FWCAG22%2FUnderstanding%2Ffocus-not-obscured-minimum.html):** Khi người dùng nhấn phím `Tab` qua các nút chọn phòng hoặc liên kết, phần tử đang nhận focus không bao giờ bị che khuất bởi thanh `.site-header` (`sticky top: 0`), `.hotel-section-nav` hoặc `.hotel-mobile-bar` (`fixed bottom: 0`).
* **Tăng tốc chọn ngày lưu trú xuyên tháng:** Hiển thị 2 tháng cạnh nhau trên màn hình Desktop (`>= 768px`) trong `DateRangePicker.tsx` thay vì khóa cứng 1 tháng.
* **Trực quan hóa thao tác chọn dải ngày trên `InventoryCalendar.tsx`:** Bổ sung trạng thái `hoveredIso` để tô màu vùng ngày dự kiến khi di chuột từ điểm neo đầu tiên (`anchor`) đến điểm đích, đồng thời rút gọn định dạng giá tiền trên màn hình hẹp để không bị cắt chữ (`truncate`).
* **Giải phóng không gian màn hình đầu tiên (Above the fold) trên `HotelListPage.tsx`:** Thu gọn chiều cao Hero từ `28.125rem` xuống thanh ngữ cảnh gọn và đóng mặc định bảng mở rộng của `HotelFilterBar` trên thiết bị di động (`< 768px`).

### 1.2. Danh mục file cần sửa và cách sửa

| File cần sửa | Vấn đề hiện tại | Cách sửa chi tiết |
| :--- | :--- | :--- |
| `frontend/src/components/common/useAnchoredPosition.ts` | Hàm `onScroll` gọi thẳng `onClose()`, làm sập menu/combobox ngay khi trang cuộn nhẹ | Thay lệnh `onClose()` trong `onScroll` và `resize` bằng `requestAnimationFrame(measure)` để tính lại tọa độ `top`/`left` bám theo phần tử gốc; chỉ gọi `onClose()` nếu phần tử neo đã cuộn khuất hoàn toàn khỏi viewport |
| `frontend/src/assets/css/base.css` | Thẻ `html` có `scroll-behavior: smooth` nhưng thiếu `scroll-padding-top` và `scroll-padding-bottom` | Bổ sung `scroll-padding-top: calc(var(--header-height) + 3.75rem)` và `scroll-padding-bottom: 5.5rem` trên `html` để trình duyệt tự động chừa khoảng trống cho sticky header và mobile bottom bar khi cuộn tới phần tử đang focus |
| `frontend/src/components/common/DateRangePicker.tsx` | Thuộc tính `numberOfMonths={1}` cố định ở mọi kích thước màn hình | Sử dụng hook `useMediaQuery('(min-width: 768px)')` sẵn có của dự án để truyền `numberOfMonths={isDesktop ? 2 : 1}` vào `<DayPicker />` |
| `frontend/src/components/owner/InventoryCalendar.tsx` | Click chọn khoảng ngày không có hiệu ứng nối dải khi di chuột (`hover`); giá VNĐ đầy đủ bị tràn ô trên mobile | Thêm state `hoverIso`, tô màu các ô nằm giữa `anchor` và `hoverIso` bằng lớp nền phụ `bg-primary-50/60 border-primary/40`; thêm hàm `formatCompactPrice` (`1.250.000 ₫` -> `1,25tr`) hiển thị trên mobile (`sm:hidden`) |
| `frontend/src/components/hotels/HotelFilterBar.tsx` | State `const [open, setOpen] = useState(true)` luôn mở toàn bộ bộ lọc trên cả màn hình điện thoại | Khởi tạo `open` dựa trên kích thước màn hình hoặc đóng mặc định khi không có bộ lọc nào đang bật trên mobile (`window.innerWidth >= 768`), giúp danh sách khách sạn xuất hiện ngay trong màn hình đầu tiên |

### 1.3. Code mẫu triển khai Giai đoạn 1

#### A. Cập nhật `frontend/src/components/common/useAnchoredPosition.ts` (Giữ Popover bám theo ô nhập khi cuộn)
```tsx
import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from 'react';

export interface AnchoredPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

const GAP = 6;
const MARGIN = 12;

export function useAnchoredPosition(
  anchor: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
  preferredHeight = 320,
  popoverWidth?: number
) {
  const [position, setPosition] = useState<AnchoredPosition | null>(null);

  const measure = useCallback(() => {
    const element = anchor.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();

    // Nếu phần tử neo đã cuộn khuất hoàn toàn khỏi vùng nhìn thấy thì mới đóng popover
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      onClose();
      return;
    }

    const below = window.innerHeight - rect.bottom - MARGIN;
    const above = rect.top - MARGIN;
    const placeAbove = below < Math.min(preferredHeight, 220) && above > below;
    const left = Math.max(
      MARGIN,
      Math.min(rect.left, window.innerWidth - MARGIN - Math.max(rect.width, popoverWidth ?? 0))
    );

    setPosition(
      placeAbove
        ? {
            bottom: window.innerHeight - rect.top + GAP,
            left,
            width: rect.width,
            maxHeight: Math.max(120, above - GAP),
          }
        : {
            top: rect.bottom + GAP,
            left,
            width: rect.width,
            maxHeight: Math.max(120, below - GAP),
          }
    );
  }, [anchor, onClose, preferredHeight, popoverWidth]);

  useLayoutEffect(() => {
    if (open) measure();
    else setPosition(null);
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    let rafId = 0;

    const scheduleMeasure = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('[data-anchored-popover]')) {
        return;
      }
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(measure);
    };

    window.addEventListener('scroll', scheduleMeasure, true);
    window.addEventListener('resize', scheduleMeasure);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', scheduleMeasure, true);
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [open, measure]);

  return position;
}
```

#### B. Cập nhật `frontend/src/assets/css/base.css` (Bảo vệ vùng Focus bàn phím theo chuẩn WCAG 2.2)
```css
html {
  -webkit-text-size-adjust: 100%;
  scroll-behavior: smooth;
  /* Đảm bảo phần tử được focus bằng phím Tab không bị che bởi Sticky Header + Section Nav ở trên
     hoặc Mobile Booking Bar ở dưới đáy màn hình (WCAG 2.2 SC 2.4.11 Focus Not Obscured) */
  scroll-padding-top: calc(var(--header-height) + 3.75rem);
  scroll-padding-bottom: 5.5rem;
}
```

#### C. Cập nhật `frontend/src/components/common/DateRangePicker.tsx` (Hiển thị 2 tháng trên Desktop)
```tsx
import { DayPicker, type DateRange, type Matcher } from 'react-day-picker';
import { vi } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { fromDateInputValue, toDateInputValue } from '../../lib/utils';
import { addDaysToDateKey } from '../../lib/stayDates';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export interface DateRangeValue {
  from: string;
  to: string;
}

export interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  min?: string;
  maxCheckIn?: string;
  maxNights?: number;
}

export function DateRangePicker({ value, onChange, min, maxCheckIn, maxNights }: DateRangePickerProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const selected: DateRange = {
    from: fromDateInputValue(value.from),
    to: fromDateInputValue(value.to),
  };
  const minDate = fromDateInputValue(min);
  const waitingForCheckOut = Boolean(value.from) && !value.to;
  const lastCheckOut =
    waitingForCheckOut && maxNights !== undefined
      ? fromDateInputValue(addDaysToDateKey(value.from, maxNights))
      : undefined;
  const lastCheckIn = fromDateInputValue(maxCheckIn);

  const disabled: Matcher[] = [];
  if (minDate) disabled.push({ before: minDate });
  if (waitingForCheckOut) {
    if (lastCheckOut) disabled.push({ after: lastCheckOut });
  } else if (lastCheckIn) {
    disabled.push({ after: lastCheckIn });
  }

  const pickDay = (day: Date) => {
    const iso = toDateInputValue(day);
    if (waitingForCheckOut && iso > value.from) {
      onChange({ from: value.from, to: iso });
    } else {
      onChange({ from: iso, to: '' });
    }
  };

  return (
    <div className="date-range-picker">
      <DayPicker
        mode="range"
        locale={vi}
        weekStartsOn={1}
        numberOfMonths={isDesktop ? 2 : 1}
        defaultMonth={selected.from ?? minDate}
        selected={selected}
        disabled={disabled.length > 0 ? disabled : undefined}
        onDayClick={pickDay}
      />
    </div>
  );
}
```

#### D. Cập nhật `frontend/src/components/owner/InventoryCalendar.tsx` (Hover Preview dải ngày + Giá rút gọn trên Mobile + Điều hướng phím mũi tên)
```tsx
import { useRef, useState, type KeyboardEvent } from 'react';
import { WEEKDAYS } from '../../features/owner/rate-range';
import { cn, formatDateVi, toDateInputValue } from '../../lib/utils';
import { addDaysToDateKey, businessToday } from '../../lib/stayDates';
import { Button } from '../common/Button';
import { Icon } from '../common/Icon';

export interface DayCell {
  price: number;
  available: number;
  closed: boolean;
}

export interface IsoRange {
  from: string;
  to: string;
}

interface InventoryCalendarProps {
  month: Date;
  cells: Record<string, DayCell>;
  selected: IsoRange | null;
  onSelect: (range: IsoRange) => void;
  onMonthChange: (month: Date) => void;
  formatPrice: (value: number) => string;
}

function formatCompactPriceVi(value: number): string {
  if (value >= 1_000_000) {
    const millions = (value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
    return `${millions}tr`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }
  return `${value}đ`;
}

export function InventoryCalendar({
  month,
  cells,
  selected,
  onSelect,
  onMonthChange,
  formatPrice,
}: InventoryCalendarProps) {
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hoverIso, setHoverIso] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const leadingBlanks = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const today = businessToday();

  const pick = (iso: string) => {
    if (!anchor) {
      setAnchor(iso);
      setHoverIso(iso);
      onSelect({ from: iso, to: iso });
      return;
    }
    const [from, to] = anchor <= iso ? [anchor, iso] : [iso, anchor];
    onSelect({ from, to });
    setAnchor(null);
    setHoverIso(null);
  };

  // Điều hướng 4 hướng bằng phím mũi tên theo chuẩn WAI-ARIA Grid Pattern
  const onCellKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIso: string) => {
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const delta = offsets[event.key];
    if (!delta) {
      if (event.key === 'Escape' && anchor) {
        event.preventDefault();
        setAnchor(null);
        setHoverIso(null);
      }
      return;
    }
    event.preventDefault();
    const targetIso = addDaysToDateKey(currentIso, delta);
    const targetBtn = gridRef.current?.querySelector<HTMLButtonElement>(
      `button[data-iso="${targetIso}"]:not(:disabled)`
    );
    if (targetBtn) {
      targetBtn.focus();
      if (anchor) setHoverIso(targetIso);
    }
  };

  const previewRange: IsoRange | null =
    anchor && hoverIso
      ? anchor <= hoverIso
        ? { from: anchor, to: hoverIso }
        : { from: hoverIso, to: anchor }
      : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onMonthChange(new Date(year, monthIndex - 1, 1))}
        >
          <Icon name="caret-left" /> Tháng trước
        </Button>
        <div className="text-center">
          <h3 aria-live="polite" className="text-base font-semibold text-heading">
            Tháng {monthIndex + 1}/{year}
          </h3>
          {anchor && (
            <p className="text-xs font-medium text-primary">
              Đã chọn ngày đầu ({formatDateVi(anchor)}) — bấm ngày kết thúc để tạo dải ngày
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onMonthChange(new Date(year, monthIndex + 1, 1))}
        >
          Tháng sau <Icon name="caret-right" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-ink-muted" aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <div key={day.value}>{day.label}</div>
        ))}
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label={`Lịch quỹ phòng tháng ${monthIndex + 1} năm ${year}`}
        className="mt-1 grid grid-cols-7 gap-1"
        onMouseLeave={() => {
          if (anchor) setHoverIso(anchor);
        }}
      >
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`blank-${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const iso = toDateInputValue(new Date(year, monthIndex, i + 1));
          const cell = cells[iso];
          const past = iso < today;
          const inCommittedRange = Boolean(selected) && iso >= selected!.from && iso <= selected!.to;
          const inPreviewRange = Boolean(previewRange) && iso >= previewRange!.from && iso <= previewRange!.to;
          const isAnchor = anchor === iso;

          const summary = cell
            ? cell.closed
              ? 'đóng bán'
              : `${formatPrice(cell.price)}, ${cell.available} phòng`
            : 'chưa có giá';

          return (
            <button
              key={iso}
              type="button"
              data-iso={iso}
              disabled={past}
              aria-pressed={inCommittedRange}
              aria-label={`${formatDateVi(iso)}, ${summary}`}
              onClick={() => pick(iso)}
              onMouseEnter={() => {
                if (anchor) setHoverIso(iso);
              }}
              onKeyDown={(e) => onCellKeyDown(e, iso)}
              className={cn(
                'flex min-h-[72px] min-w-0 flex-col items-start gap-0.5 rounded-lg border p-1.5 text-left transition-colors sm:p-2',
                inCommittedRange
                  ? 'border-primary bg-primary-50'
                  : inPreviewRange
                    ? 'border-primary/50 bg-primary-50/50'
                    : 'border-border bg-surface hover:bg-surface-secondary',
                isAnchor && 'ring-2 ring-primary ring-offset-1',
                cell?.closed && !inCommittedRange && !inPreviewRange && 'bg-surface-tertiary',
                past && 'cursor-not-allowed opacity-40'
              )}
            >
              <span className="text-xs font-medium text-ink-muted">{i + 1}</span>
              {cell && !cell.closed ? (
                <>
                  <span className="hidden w-full truncate text-sm font-semibold text-ink sm:block">
                    {formatPrice(cell.price)}
                  </span>
                  <span className="block w-full truncate text-xs font-semibold text-ink sm:hidden">
                    {formatCompactPriceVi(cell.price)}
                  </span>
                </>
              ) : (
                <span className="text-xs text-ink-muted">{cell ? '—' : ''}</span>
              )}
              <span className="w-full truncate text-[11px] text-ink-muted">
                {cell ? (cell.closed ? 'Đóng' : `${cell.available} p.`) : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```


## Giai Đoạn 2: Tối Ưu Chuyển Đổi Đặt Phòng & Hiện Đại Hóa Tìm Kiếm

### 2.1. Mục tiêu cần đạt được
* **Biến `MobileBookingBar.tsx` và `BookingPanel.tsx` trên di động thành Bottom Sheet (`<dialog>`):** Khi người dùng trên điện thoại bấm *"Xem chi tiết & đặt phòng"*, mở một ngăn kéo từ đáy màn hình chứa toàn bộ chi tiết báo giá, ô nhập mã khuyến mãi (`PromoPicker`) và nút xác nhận thay vì bắt người dùng cuộn nhảy cóc xuống cuối trang.
* **Bổ sung bước Kiểm tra & Xác nhận Đặt phòng (Booking Review Dialog) trước khi gọi API tạo đơn:** Tránh việc bấm nhầm nút *"Tạo đặt phòng"* làm khóa phòng ngay lập tức; hiển thị rõ tóm tắt ngày nhận/trả phòng, danh sách phòng, tổng tiền thanh toán, ghi chú và chính sách hoàn hủy để khách xác nhận lần cuối.
* **Làm giàu thông tin quyết định trên `HotelCard.tsx`:** Hiển thị đầy đủ địa chỉ chi tiết (`hotel.DiaChiChiTiet` kết hợp `hotel.DiaPhuong.TenThanhPho`), tính số đêm lưu trú từ tham số tìm kiếm để hiển thị cả **Giá 1 đêm** lẫn **Tổng giá dự kiến cho cả kỳ nghỉ**, giúp người dùng không phải tự nhân nhẩm.
* **Chuyển `HotelFilterBar.tsx` sang cơ chế Lọc trực tiếp có Debounce (Live Debounced Filtering):** Tự động áp dụng bộ lọc sau `350ms` kể từ khi người dùng dừng thao tác kéo giá/chọn sao/tiện nghi, kết hợp `placeholderData: keepPreviousData` của TanStack Query để danh sách kết quả cập nhật mượt mà không bị nhấp nháy Skeleton.

### 2.2. Danh mục file cần sửa và cách sửa

| File cần sửa | Vấn đề hiện tại | Cách sửa chi tiết |
| :--- | :--- | :--- |
| `frontend/src/components/hotels/HotelCard.tsx` | Bỏ sót trường `hotel.DiaChiChiTiet` đã có sẵn từ API; chỉ hiện giá 1 đêm mà không hiện tổng tiền theo số đêm đang tìm | Đọc `checkIn` và `checkOut` từ chuỗi `search` truyền vào, dùng `countNights` để tính số đêm; hiển thị `hotel.DiaChiChiTiet, hotel.DiaPhuong.TenThanhPho` và dòng phụ `Tổng ~ {formatCurrencyVND(GiaTuDauTu * nights)} cho {nights} đêm` |
| `frontend/src/components/hotels/detail/MobileBookingBar.tsx` & `pages/public/HotelDetailPage.tsx` | Nút trên `MobileBookingBar` chỉ gọi `document.getElementById('dat-phong')?.scrollIntoView()` | Thêm state `isMobileSheetOpen` trong `HotelDetailPage.tsx`; khi ở màn hình `< 1024px`, render `BookingPanel` bên trong một `<dialog className="mobile-booking-sheet">` có khóa cuộn và đóng bằng phím `Escape` |
| `frontend/src/components/hotels/detail/BookingPanel.tsx` | Nút *"Tạo đặt phòng"* gọi thẳng `onBook()` kích hoạt mutation tạo đơn ngay lập tức | Bổ sung hộp thoại xác nhận tóm tắt đơn (`BookingReviewDialog`) hiển thị rõ các hạng mục phòng, ngày giờ check-in/check-out của khách sạn và điều khoản hủy trước khi thực sự gọi `onBook()` |
| `frontend/src/features/hotels/hooks.ts` & `components/hotels/HotelFilterBar.tsx` | Mỗi lần đổi bộ lọc phải bấm nút *"Áp dụng bộ lọc"*; khi lọc lại toàn bộ danh sách biến thành Skeleton gây giật trang | Bổ sung `placeholderData: keepPreviousData` vào `useSearchHotels` trong `features/hotels/hooks.ts`; sử dụng `useDebouncedValue(draft, 350)` trong `HotelFilterBar.tsx` để tự động đồng bộ bộ lọc lên URL |

### 2.3. Code mẫu triển khai Giai đoạn 2

#### A. Nâng cấp `frontend/src/components/hotels/HotelCard.tsx` (Hiển thị Địa chỉ chi tiết + Tổng giá kỳ lưu trú)
```tsx
import { Link } from 'react-router-dom';
import type { HotelSearchItem } from '../../features/hotels/types';
import { formatCurrencyVND } from '../../lib/utils';
import { formatRating } from '../../features/reviews/rating';
import { countNights } from '../../lib/stayDates';

export function HotelCard({ hotel, search }: { hotel: HotelSearchItem; search: string }) {
  const detailUrl = `/hotels/${hotel.MaKhachSan}?${search}`;
  const params = new URLSearchParams(search);
  const checkIn = params.get('checkIn') ?? '';
  const checkOut = params.get('checkOut') ?? '';
  const nights = checkIn && checkOut ? Math.max(1, countNights(checkIn, checkOut)) : 1;
  const estimatedTotal = hotel.GiaTuDauTu !== null ? hotel.GiaTuDauTu * nights : null;

  return (
    <article className="hotel-card-v2">
      <Link
        className="hotel-card-v2__media"
        to={detailUrl}
        aria-label={`Xem phòng tại ${hotel.TenKhachSan}`}
      >
        {hotel.AnhDaiDien ? (
          <img
            src={hotel.AnhDaiDien}
            alt=""
            width={320}
            height={240}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="hotel-card-v2__fallback" aria-hidden="true">
            <i className="ph ph-image" />
          </span>
        )}
      </Link>

      <div className="hotel-card-v2__identity">
        <div className="hotel-card-v2__title-row">
          <h2>
            <Link to={detailUrl}>{hotel.TenKhachSan}</Link>
          </h2>
          {hotel.HangSao > 0 && (
            <span className="hotel-card-v2__stars" role="img" aria-label={`${hotel.HangSao} sao`}>
              {'★'.repeat(Math.min(5, hotel.HangSao))}
            </span>
          )}
        </div>

        {(hotel.SoLuongDanhGia ?? 0) > 0 && (
          <p className="hotel-card-v2__rating">
            <strong>{formatRating(hotel.DiemTrungBinh ?? null)}</strong>/5 · {hotel.SoLuongDanhGia} đánh giá
          </p>
        )}

        <p className="hotel-card-v2__location" title={`${hotel.DiaChiChiTiet}, ${hotel.DiaPhuong.TenThanhPho}`}>
          <i className="ph ph-map-pin" aria-hidden="true" />
          <span>
            {hotel.DiaChiChiTiet
              ? `${hotel.DiaChiChiTiet}, ${hotel.DiaPhuong.TenThanhPho}`
              : hotel.DiaPhuong.TenThanhPho}
          </span>
        </p>

        <p className={`hotel-card-v2__availability ${hotel.ConPhong ? 'is-available' : 'is-unavailable'}`}>
          {hotel.ConPhong ? 'Còn phòng theo ngày đã chọn' : 'Hết phòng theo ngày đã chọn'}
        </p>
      </div>

      <div className="hotel-card-v2__commercial">
        {hotel.GiaTuDauTu !== null ? (
          <>
            <span className="hotel-card-v2__price-label">Giá khởi điểm / đêm</span>
            <strong>{formatCurrencyVND(hotel.GiaTuDauTu)}</strong>
            {nights > 1 && estimatedTotal !== null && (
              <small className="block text-xs text-ink-muted">
                Tổng ~ {formatCurrencyVND(estimatedTotal)} cho {nights} đêm
              </small>
            )}
          </>
        ) : (
          <span className="hotel-card-v2__price-label">Chưa có giá để hiển thị</span>
        )}
        <Link to={detailUrl} className="hotel-card-v2__action">
          {hotel.ConPhong ? 'Chọn phòng' : 'Xem khách sạn'} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
```

#### B. Nâng cấp `frontend/src/components/hotels/detail/MobileBookingBar.tsx` (Mở Bottom Sheet Drawer trên Mobile & Bảng Review Xác nhận)
```tsx
import { useEffect, useRef } from 'react';
import { Button } from '../../common/Button';
import { Icon } from '../../common/Icon';

interface MobileBookingBarProps {
  roomCount: number;
  total: string;
  sheetOpen: boolean;
  onOpenSheet: () => void;
  onCloseSheet: () => void;
  children?: React.ReactNode;
}

export function MobileBookingBar({
  roomCount,
  total,
  sheetOpen,
  onOpenSheet,
  onCloseSheet,
  children,
}: MobileBookingBarProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (sheetOpen && !dialog.open) {
      dialog.showModal();
    } else if (!sheetOpen && dialog.open) {
      dialog.close();
    }
  }, [sheetOpen]);

  return (
    <>
      <div className="hotel-mobile-bar lg:hidden" role="region" aria-label="Tóm tắt lựa chọn phòng">
        <div className="min-w-0">
          <p className="text-xs text-ink-muted">{roomCount} phòng đã chọn</p>
          <p className="truncate text-base font-bold text-ink">{total}</p>
        </div>
        <Button type="button" className="shrink-0" onClick={onOpenSheet}>
          Xem báo giá &amp; đặt phòng
        </Button>
      </div>

      <dialog
        ref={dialogRef}
        aria-label="Chi tiết báo giá và đặt phòng"
        onClose={onCloseSheet}
        onClick={(e) => {
          if (e.target === dialogRef.current) onCloseSheet();
        }}
        className="m-0 mt-auto max-h-[88dvh] w-full max-w-none rounded-t-2xl border-0 bg-surface p-0 shadow-lg backdrop:bg-slate-900/50 lg:hidden"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-5 py-3.5">
          <span className="text-base font-bold text-ink">Chi tiết đặt phòng</span>
          <button
            type="button"
            aria-label="Đóng bảng đặt phòng"
            onClick={onCloseSheet}
            className="grid h-9 w-9 place-items-center rounded-full text-ink-sub hover:bg-surface-subtle"
          >
            <Icon name="x" size={18} weight="bold" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </dialog>
    </>
  );
}
```

#### C. Giữ mượt danh sách khi lọc trong `frontend/src/features/hotels/hooks.ts`
```tsx
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { searchHotels } from './api';
import type { HotelSearchParams } from './types';

export function useSearchHotels(params: HotelSearchParams) {
  return useQuery({
    queryKey: ['hotels', 'search', params],
    queryFn: () => searchHotels(params),
    // Giữ danh sách khách sạn hiện tại trên màn hình trong lúc tải bộ lọc mới,
    // kết hợp badge "Đang cập nhật..." thay vì xóa trắng màn hình bằng Skeleton
    placeholderData: keepPreviousData,
  });
}
```



#### D. Bổ sung Hộp thoại Xác nhận Đặt phòng (`BookingReviewDialog`) trong `frontend/src/components/hotels/detail/BookingPanel.tsx`
```tsx
import { useRef, useState } from 'react';
import type { Quote } from '../../../features/quotes/types';
import { formatCurrencyVND } from '../../../lib/utils';
import { Button } from '../../common/Button';

export function BookingConfirmTrigger({
  quote,
  note,
  isBooking,
  disabled,
  onConfirmBook,
}: {
  quote: Quote;
  note: string;
  isBooking: boolean;
  disabled: boolean;
  onConfirmBook: () => void;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const openDialog = () => {
    setOpen(true);
    dialogRef.current?.showModal();
  };

  const closeDialog = () => {
    setOpen(false);
    dialogRef.current?.close();
  };

  return (
    <>
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={disabled}
        loading={isBooking}
        onClick={openDialog}
      >
        Kiểm tra &amp; xác nhận đặt phòng
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="booking-review-title"
        onClose={closeDialog}
        className="confirm-dialog max-w-lg rounded-xl border border-border bg-surface p-6 shadow-lg"
      >
        <h3 id="booking-review-title" className="text-lg font-bold text-ink">
          Xác nhận thông tin đặt phòng
        </h3>
        <p className="mt-1 text-xs text-ink-muted">
          Vui lòng kiểm tra kỹ danh sách phòng và điều khoản hủy trước khi giữ chỗ.
        </p>

        <div className="mt-4 space-y-2 rounded-lg bg-surface-secondary p-3.5 text-sm">
          {quote.ChiTietPhong.map((line) => (
            <div key={line.MaLoaiPhong} className="flex justify-between gap-2">
              <span className="font-medium text-ink">
                {line.SoLuongYeuCau} × {line.TenLoaiPhong} ({quote.SoDem} đêm)
              </span>
              <span className="font-semibold text-ink">
                {formatCurrencyVND(line.ThanhTien ?? 0)}
              </span>
            </div>
          ))}
          {quote.PromoHopLe && quote.SoTienGiam > 0 && (
            <div className="flex justify-between text-xs font-semibold text-success-ink">
              <span>Giảm giá khuyến mãi</span>
              <span>−{formatCurrencyVND(quote.SoTienGiam)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2 text-base font-bold text-primary">
            <span>Tổng thanh toán</span>
            <span>{formatCurrencyVND(quote.TongTienThanhToan)}</span>
          </div>
        </div>

        {note.trim() && (
          <p className="mt-3 text-xs text-ink-sub">
            <strong>Ghi chú gửi khách sạn:</strong> {note}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={closeDialog}>
            Quay lại chỉnh sửa
          </Button>
          <Button
            type="button"
            loading={isBooking}
            onClick={() => {
              closeDialog();
              onConfirmBook();
            }}
          >
            {quote.TongTienThanhToan === 0 ? 'Hoàn tất đặt phòng' : 'Tạo đơn & tới thanh toán'}
          </Button>
        </div>
      </dialog>
    </>
  );
}
```

## Giai Đoạn 3: Hiện Đại Hóa Công Cụ Vận Hành (Owner/Admin) & Dọn Nợ Kỹ Thuật CSS

### 3.1. Mục tiêu cần đạt được
* **Xây dựng Ma trận Đa loại phòng (Multi-Room Rate & Inventory Matrix / Tape Chart) cho Chủ khách sạn:** Trên trang `OwnerInventoryPricingPage.tsx`, bên cạnh chế độ xem Lịch 1 tháng của 1 loại phòng, bổ sung chế độ **“Ma trận toàn khách sạn (14 ngày)”** hiển thị tất cả loại phòng trên cùng một bảng lưới để chủ khách sạn đối chiếu giá và số phòng trống giữa các hạng phòng trong tích tắc.
* **Tích hợp Bố cục Chia đôi Danh sách – Bản đồ (Split-View Layout) trên `HotelListPage.tsx`:** Áp dụng khuyến nghị từ [nghiên cứu Split-View của Baymard Institute](https://www.google.com/search?q=https%3A%2F%2Fbaymard.com%2Fresearch-articles%2Faccommodations-split-view), cho phép người dùng bật chế độ xem song song Danh sách khách sạn bên trái và Bản đồ định vị khu vực bên phải (`sticky`), đồng bộ trạng thái hover giữa thẻ khách sạn và ghim giá trên bản đồ.
* **Nâng cấp `DataTable.tsx` thích ứng bằng [CSS Container Queries (@container)](https://www.google.com/search?q=https%3A%2F%2Fdeveloper.mozilla.org%2Fen-US%2Fdocs%2FWeb%2FCSS%2FGuides%2FContainment%2FContainer_queries) và hỗ trợ Bulk Actions:** Khi vùng chứa bảng hẹp dưới `640px`, tự động chuyển từng hàng `<tr>` thành thẻ thông tin xếp dọc có nhãn cột (`data-label`) rõ ràng thay vì bắt người dùng cuộn ngang; bổ sung tùy chọn tích chọn nhiều dòng (`selectedRowKeys`) cho Admin.
* **Chuẩn hóa 100% Design Tokens & Loại bỏ `ResizeObserver` thừa:** Thay thế đoạn mã `ResizeObserver` đếm cột trong `HotelFilterBar.tsx` bằng CSS Grid tự động `grid-template-columns: repeat(auto-fill, minmax(11.5rem, 1fr))`; quy chuẩn toàn bộ 49 mã màu Hex cứng và 349 giá trị arbitrary (`rounded-[1.375rem]`, `text-[0.6875rem]`) về đúng hệ biến ngữ nghĩa trong `variables.css`.

### 3.2. Danh mục file cần sửa và cách sửa

| File cần sửa / tạo mới | Vấn đề hiện tại | Cách sửa chi tiết |
| :--- | :--- | :--- |
| `frontend/src/components/owner/MultiRoomRateMatrix.tsx` (Mới) & `pages/owner/OwnerInventoryPricingPage.tsx` | Chủ khách sạn phải chuyển đổi qua lại từng loại phòng trong `<Select>` để xem giá và tồn phòng | Tạo component `MultiRoomRateMatrix` nhận danh sách `roomTypes` và dải 14 ngày; hiển thị cột đầu tiên cố định (`sticky left-0`) là tên loại phòng, các cột tiếp theo là từng ngày với giá và số phòng trống; bấm vào ô nào sẽ chọn ngay loại phòng và ngày đó để cập nhật |
| `frontend/src/components/common/DataTable.tsx` & `assets/css/components.css` | Bảng dữ liệu rộng bị tràn ngang trên màn hình nhỏ; thiếu khả năng chọn nhiều dòng để thao tác hàng loạt | Bọc `DataTable` trong `.table-container { container-type: inline-size; }`; thêm thuộc tính `data-label={column.headerText}` vào `<td>` để dưới `@container (max-width: 640px)` bảng tự chuyển sang dạng Card; thêm prop tùy chọn `selectable` và thanh công cụ nổi khi có dòng được chọn |
| `frontend/src/components/hotels/HotelFilterBar.tsx` & `assets/css/booking-flow.css` | Dùng `ResizeObserver` và `useLayoutEffect` trong React chỉ để tính số cột `.hotel-filter__amenity-grid` | Xóa `ResizeObserver` và state `columns`; dùng CSS `grid-template-columns: repeat(auto-fill, minmax(11.5rem, 1fr))` kết hợp giới hạn chiều cao khi thu gọn |
| `frontend/src/assets/css/variables.css` & `pages/public/HotelListPage.tsx` | Còn 49 mã màu Hex thô (`#f6f8fb`, `#061a2d`) và 349 class kích thước lẻ (`rounded-[1.375rem]`, `rounded-[1.5rem]`) | Ánh xạ toàn bộ nền trang về `var(--color-surface-page)`, bo góc thẻ về `var(--radius-surface)` (`0.75rem`) hoặc bổ sung token `--radius-surface-lg: 1rem` chính thức vào `variables.css` và `@theme` trong `index.css` |

### 3.3. Code mẫu triển khai Giai đoạn 3

#### A. Component mới `frontend/src/components/owner/MultiRoomRateMatrix.tsx` (Bảng Ma trận Đa loại phòng 14 ngày cho Chủ khách sạn)
```tsx
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { getRates } from '../../features/owner/api';
import type { RoomType } from '../../features/owner/types';
import { addDaysToDateKey, businessToday } from '../../lib/stayDates';
import { cn, formatCurrencyVND, formatDateVi } from '../../lib/utils';

interface MultiRoomRateMatrixProps {
  roomTypes: RoomType[];
  startDate: string;
  daysCount?: number;
  selectedRoomTypeId?: number;
  selectedDate?: string;
  onSelectCell: (roomTypeId: number, dateIso: string) => void;
}

export function MultiRoomRateMatrix({
  roomTypes,
  startDate,
  daysCount = 14,
  selectedRoomTypeId,
  selectedDate,
  onSelectCell,
}: MultiRoomRateMatrixProps) {
  const today = businessToday();
  const dates = useMemo(
    () => Array.from({ length: daysCount }, (_, idx) => addDaysToDateKey(startDate, idx)),
    [startDate, daysCount]
  );
  const endDate = dates[dates.length - 1] ?? startDate;

  const rateQueries = useQueries({
    queries: roomTypes.map((rt) => ({
      queryKey: ['owner', 'rates', rt.MaLoaiPhong, startDate, endDate],
      queryFn: () => getRates(rt.MaLoaiPhong, startDate, endDate),
      staleTime: 60_000,
    })),
  });

  return (
    <div className="surface-card overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-border bg-surface-subtle">
            <th
              scope="col"
              className="sticky left-0 z-20 min-w-[11rem] border-r border-border bg-surface-subtle px-3 py-2.5 font-semibold text-ink"
            >
              Hạng phòng
            </th>
            {dates.map((iso) => {
              const [, month, day] = iso.split('-');
              const isPast = iso < today;
              return (
                <th
                  key={iso}
                  scope="col"
                  className={cn(
                    'min-w-[5.25rem] border-r border-border px-2 py-2 text-center font-semibold',
                    isPast ? 'text-ink-muted opacity-60' : 'text-ink'
                  )}
                >
                  <span className="block text-[11px] text-ink-muted">{day}/{month}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {roomTypes.map((rt, rowIdx) => {
            const query = rateQueries[rowIdx];
            const byDate = new Map(
              (query?.data ?? []).map((row) => [row.NgayApDung.slice(0, 10), row])
            );

            return (
              <tr key={rt.MaLoaiPhong} className="border-b border-border last:border-b-0">
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-r border-border bg-surface px-3 py-2.5 font-semibold text-ink"
                >
                  <span className="block truncate">{rt.TenLoaiPhong}</span>
                  <small className="font-normal text-ink-muted">Tối đa {rt.SucChua} khách</small>
                </th>
                {dates.map((iso) => {
                  const record = byDate.get(iso);
                  const isPast = iso < today;
                  const isClosed = record?.TrangThai === 'Đóng bán';
                  const isSelected =
                    selectedRoomTypeId === rt.MaLoaiPhong && selectedDate === iso;

                  return (
                    <td key={iso} className="border-r border-border p-1">
                      <button
                        type="button"
                        disabled={isPast}
                        aria-label={`${rt.TenLoaiPhong} ngày ${formatDateVi(iso)}: ${
                          record
                            ? `${formatCurrencyVND(record.GiaPhong)}, ${record.SoLuongPhong} phòng, ${record.TrangThai}`
                            : 'Chưa thiết lập'
                        }`}
                        onClick={() => onSelectCell(rt.MaLoaiPhong, iso)}
                        className={cn(
                          'flex min-h-[3.25rem] w-full flex-col items-center justify-center rounded-md px-1.5 py-1 text-center transition-colors',
                          isSelected
                            ? 'bg-primary-50 ring-2 ring-primary'
                            : isClosed
                              ? 'bg-surface-tertiary text-ink-muted'
                              : 'hover:bg-surface-secondary',
                          isPast && 'cursor-not-allowed opacity-40'
                        )}
                      >
                        {query?.isLoading ? (
                          <span className="text-[11px] text-ink-muted">...</span>
                        ) : record ? (
                          <>
                            <span className="font-semibold text-ink">
                              {isClosed ? 'Đóng' : `${Math.round(record.GiaPhong / 1000)}k`}
                            </span>
                            <span
                              className={cn(
                                'text-[10px]',
                                record.SoLuongPhong === 0 ? 'font-bold text-danger-ink' : 'text-ink-muted'
                              )}
                            >
                              {record.SoLuongPhong} p.
                            </span>
                          </>
                        ) : (
                          <span className="text-[11px] text-ink-muted">—</span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

#### B. Nâng cấp `frontend/src/components/common/DataTable.tsx` & `assets/css/components.css` (Thích ứng bằng CSS Container Queries & Chọn nhiều dòng)
```tsx
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Nhãn văn bản thuần hiển thị ở chế độ thẻ dọc trên màn hình nhỏ (@container < 640px) */
  mobileLabel?: string;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  getRowKey: (row: T) => string | number;
  caption: string;
  isLoading?: boolean;
  error?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: string;
  footer?: ReactNode;
  bare?: boolean;
  /** Hỗ trợ chọn nhiều dòng để thực hiện thao tác hàng loạt (Bulk Actions) */
  selectedKeys?: Set<string | number>;
  onToggleRow?: (key: string | number) => void;
  onToggleAll?: (checked: boolean) => void;
  bulkActionsBar?: ReactNode;
}

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  caption,
  isLoading,
  error,
  emptyTitle = 'Chưa có dữ liệu',
  emptyDescription,
  emptyIcon,
  footer,
  bare,
  selectedKeys,
  onToggleRow,
  onToggleAll,
  bulkActionsBar,
}: DataTableProps<T>) {
  const selectable = Boolean(selectedKeys && onToggleRow);
  const allSelected =
    Boolean(rows && rows.length > 0 && selectedKeys) &&
    rows!.every((row) => selectedKeys!.has(getRowKey(row)));

  let body: ReactNode;
  if (isLoading) {
    body = (
      <div role="status" aria-busy="true" className="grid gap-4 p-4">
        <span className="sr-only">Đang tải...</span>
        {Array.from({ length: 5 }, (_, r) => (
          <Skeleton key={r} className="h-6 w-full" />
        ))}
      </div>
    );
  } else if (error) {
    body = (
      <div role="alert" className="px-6 py-10 text-center text-sm text-danger-ink">
        {error}
      </div>
    );
  } else if (!rows || rows.length === 0) {
    body = <EmptyState title={emptyTitle} description={emptyDescription} icon={emptyIcon} />;
  } else {
    body = (
      <div className="data-table-container max-h-[70vh] overflow-auto">
        {selectable && selectedKeys!.size > 0 && bulkActionsBar && (
          <div
            role="region"
            aria-label="Thao tác hàng loạt"
            className="sticky top-0 z-20 flex items-center justify-between border-b border-primary/20 bg-primary-50 px-4 py-2.5 text-sm"
          >
            <span className="font-semibold text-primary-800">
              Đã chọn {selectedKeys!.size} mục
            </span>
            <div className="flex items-center gap-2">{bulkActionsBar}</div>
          </div>
        )}
        <table className="data-table">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10">
            <tr>
              {selectable && (
                <th scope="col" className="w-10 text-center">
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả các dòng trên trang này"
                    checked={allSelected}
                    onChange={(e) => onToggleAll?.(e.target.checked)}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(ALIGN[column.align ?? 'left'], column.className)}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rowKey = getRowKey(row);
              const isSelected = selectable && selectedKeys!.has(rowKey);
              return (
                <tr key={rowKey} className={cn(isSelected && 'bg-primary-50/60')}>
                  {selectable && (
                    <td data-label="Chọn" className="w-10 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Chọn dòng ${rowKey}`}
                        checked={isSelected}
                        onChange={() => onToggleRow?.(rowKey)}
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      data-label={
                        column.mobileLabel ??
                        (typeof column.header === 'string' ? column.header : undefined)
                      }
                      className={cn(ALIGN[column.align ?? 'left'], column.className)}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (bare) return <>{body}{footer}</>;
  return (
    <div className="surface-card flex flex-col overflow-hidden">
      {body}
      {footer}
    </div>
  );
}
```

Đi kèm quy tắc `@container` trong `frontend/src/assets/css/components.css`:
```css
.data-table-container {
  container-type: inline-size;
  container-name: datatable;
}

@container datatable (max-width: 640px) {
  .data-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }

  .data-table tbody tr {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-4);
    border-bottom: 1px solid var(--color-border-default);
  }

  .data-table tbody td {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    padding: 0;
    border: 0;
    text-align: right;
  }

  .data-table tbody td::before {
    content: attr(data-label);
    font-size: var(--font-size-caption);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-muted);
    text-align: left;
  }
}
```


## Danh Mục Kiểm Tra Chất Lượng (Quality Gates) Sau Khi Thực Thi

Trước khi đóng từng giai đoạn, chạy bộ lệnh kiểm tra tự động của dự án tại thư mục `frontend/`:

1. **Kiểm tra kiểu dữ liệu TypeScript:** `npm run typecheck` (đảm bảo 0 lỗi biên dịch khi mở rộng props cho `DataTable`, `MobileBookingBar`, `InventoryCalendar`).
2. **Kiểm tra quy tắc ESLint & Accessibility:** `npm run lint` (đảm bảo không vi phạm quy tắc thẻ `<main>` đơn nhất và các thuộc tính ARIA).
3. **Chạy toàn bộ Unit & Integration Tests:** `npm test` (cập nhật và bổ sung test trong `DateRangePicker.test.tsx`, `InventoryCalendar.test.tsx`, `DataTable.test.tsx` và `HotelFilterBar.test.tsx`).
4. **Kiểm tra số lượng mã màu thô và kích thước tùy ý:**
   * Chạy `grep -rnE "#[0-9a-fA-F]{3,6}" src/pages/ src/components/` để xác nhận số lượng mã màu Hex cứng giảm về `0`.
   * Kiểm tra thao tác nhấn phím `Tab` xuyên suốt từ đầu đến cuối trang `HotelDetailPage` ở cả kích thước `375px` (Mobile) và `1440px` (Desktop) để đảm bảo không có phần tử focus nào bị khuất sau các thanh sticky.
