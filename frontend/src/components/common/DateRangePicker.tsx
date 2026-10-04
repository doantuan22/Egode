import { DayPicker, type DateRange, type Matcher } from 'react-day-picker';
import { vi } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { fromDateInputValue, toDateInputValue } from '../../lib/utils';
import { addDaysToDateKey } from '../../lib/stayDates';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export interface DateRangeValue {
  /** YYYY-MM-DD, or '' while nothing is chosen. */
  from: string;
  to: string;
}

export interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  /** Earliest selectable day (YYYY-MM-DD). Omit to allow past days. */
  min?: string;
  /** Latest selectable check-in (YYYY-MM-DD). */
  maxCheckIn?: string;
  /** Longest stay in nights: once a check-in is picked, check-out days further away are disabled. */
  maxNights?: number;
}

/** Inline check-in / check-out calendar. Works on `YYYY-MM-DD` strings so callers keep their string state and URL params. */
export function DateRangePicker({ value, onChange, min, maxCheckIn, maxNights }: DateRangePickerProps) {
  const twoMonths = useMediaQuery('(min-width: 768px)');
  const selected: DateRange = { from: fromDateInputValue(value.from), to: fromDateInputValue(value.to) };
  const minDate = fromDateInputValue(min);
  const waitingForCheckOut = Boolean(value.from) && !value.to;
  const lastCheckOut = waitingForCheckOut && maxNights !== undefined ? fromDateInputValue(addDaysToDateKey(value.from, maxNights)) : undefined;
  const lastCheckIn = fromDateInputValue(maxCheckIn);
  // Choosing a check-out: nothing before the check-in's following day and nothing beyond maxNights.
  // Choosing a check-in: nothing before today and nothing beyond the booking window.
  const disabled: Matcher[] = [];
  if (minDate) disabled.push({ before: minDate });
  if (waitingForCheckOut) {
    if (lastCheckOut) disabled.push({ after: lastCheckOut });
  } else if (lastCheckIn) {
    disabled.push({ after: lastCheckIn });
  }

  // A booking range always starts fresh once it is complete, instead of stretching the old one.
  const pickDay = (day: Date) => {
    const iso = toDateInputValue(day);
    if (waitingForCheckOut && iso > value.from) onChange({ from: value.from, to: iso });
    else onChange({ from: iso, to: '' });
  };

  return (
    <div className="date-range-picker">
      <DayPicker
        mode="range"
        locale={vi}
        weekStartsOn={1}
        numberOfMonths={twoMonths ? 2 : 1}
        defaultMonth={selected.from ?? minDate}
        selected={selected}
        disabled={disabled.length > 0 ? disabled : undefined}
        onDayClick={pickDay}
      />
    </div>
  );
}
