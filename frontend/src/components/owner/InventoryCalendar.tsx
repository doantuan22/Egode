import { useState } from 'react';
import { WEEKDAYS } from '../../features/owner/rate-range';
import { cn, formatDateVi, toDateInputValue } from '../../lib/utils';
import { businessToday } from '../../lib/stayDates';
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
  /** Any day of the month to show. */
  month: Date;
  /** Saved rate per day, keyed by YYYY-MM-DD. Days with no record are shown empty. */
  cells: Record<string, DayCell>;
  /** The range that the update form will apply to. */
  selected: IsoRange | null;
  onSelect: (range: IsoRange) => void;
  onMonthChange: (month: Date) => void;
  formatPrice: (value: number) => string;
}

/**
 * Month grid of price and rooms left per day. Click a first day, then a last day, to pick a range;
 * a third click starts a new one. Past days cannot be picked.
 */
export function InventoryCalendar({ month, cells, selected, onSelect, onMonthChange, formatPrice }: InventoryCalendarProps) {
  const [anchor, setAnchor] = useState<string | null>(null);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  // Monday-first: JS Sunday is 0, so shift it to the end.
  const leadingBlanks = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const today = businessToday(); // a night is "past" by Vietnam's calendar, the same day the server uses

  const pick = (iso: string) => {
    if (!anchor) {
      setAnchor(iso);
      onSelect({ from: iso, to: iso });
      return;
    }
    const [from, to] = anchor <= iso ? [anchor, iso] : [iso, anchor];
    onSelect({ from, to });
    setAnchor(null);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onMonthChange(new Date(year, monthIndex - 1, 1))}>
          <Icon name="caret-left" /> Tháng trước
        </Button>
        <h3 aria-live="polite" className="text-base font-semibold text-heading">Tháng {monthIndex + 1}/{year}</h3>
        <Button type="button" variant="outline" size="sm" onClick={() => onMonthChange(new Date(year, monthIndex + 1, 1))}>
          Tháng sau <Icon name="caret-right" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-ink-muted" aria-hidden="true">
        {WEEKDAYS.map((day) => <div key={day.value}>{day.label}</div>)}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }, (_, i) => <div key={`blank-${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const iso = toDateInputValue(new Date(year, monthIndex, i + 1));
          const cell = cells[iso];
          const past = iso < today;
          const inRange = Boolean(selected) && iso >= selected!.from && iso <= selected!.to;
          const summary = cell ? (cell.closed ? 'đóng bán' : `${formatPrice(cell.price)}, ${cell.available} phòng`) : 'chưa có giá';
          return (
            <button
              key={iso}
              type="button"
              disabled={past}
              aria-pressed={inRange}
              aria-label={`${formatDateVi(iso)}, ${summary}`}
              onClick={() => pick(iso)}
              className={cn(
                'flex min-h-[72px] min-w-0 flex-col items-start gap-0.5 rounded-lg border p-1.5 text-left transition-colors sm:p-2',
                inRange ? 'border-primary bg-primary-50' : 'border-border bg-surface hover:bg-surface-secondary',
                cell?.closed && !inRange && 'bg-surface-tertiary',
                past && 'cursor-not-allowed opacity-40'
              )}
            >
              <span className="text-xs text-ink-muted">{i + 1}</span>
              <span className="w-full truncate text-xs font-semibold text-ink sm:text-sm">{cell && !cell.closed ? formatPrice(cell.price) : cell ? '—' : ''}</span>
              <span className="text-[11px] text-ink-muted">{cell ? (cell.closed ? 'Đóng bán' : `${cell.available} phòng`) : ''}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
