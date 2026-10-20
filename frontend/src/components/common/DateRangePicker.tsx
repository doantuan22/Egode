import { DayPicker, type DateRange, type Matcher } from 'react-day-picker';
import { vi } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { fromDateInputValue, toDateInputValue } from '../../lib/utils';
import { addDaysToDateKey } from '../../lib/stayDates';

export interface DateRangeValue {
  /** YYYY-MM-DD hoặc rỗng */
  from: string;
  to: string;
}

export interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  /** Ngày sớm nhất chọn được */
  min?: string;
  /** Ngày nhận phòng muộn nhất */
  maxCheckIn?: string;
  /** Số đêm tối đa */
  maxNights?: number;
}

/** Lịch chọn ngày nhận và trả phòng */
export function DateRangePicker({ value, onChange, min, maxCheckIn, maxNights }: DateRangePickerProps) {
  const selected: DateRange = { from: fromDateInputValue(value.from), to: fromDateInputValue(value.to) };
  const minDate = fromDateInputValue(min);
  const waitingForCheckOut = Boolean(value.from) && !value.to;
  const lastCheckOut = waitingForCheckOut && maxNights !== undefined ? fromDateInputValue(addDaysToDateKey(value.from, maxNights)) : undefined;
  const lastCheckIn = fromDateInputValue(maxCheckIn);
  // Giới hạn ngày chọn theo bước đang chọn
  const disabled: Matcher[] = [];
  if (minDate) disabled.push({ before: minDate });
  if (waitingForCheckOut) {
    if (lastCheckOut) disabled.push({ after: lastCheckOut });
  } else if (lastCheckIn) {
    disabled.push({ after: lastCheckIn });
  }

  // Chọn xong một khoảng thì lần sau bắt đầu lại
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
        numberOfMonths={1}
        defaultMonth={selected.from ?? minDate}
        selected={selected}
        disabled={disabled.length > 0 ? disabled : undefined}
        onDayClick={pickDay}
      />
    </div>
  );
}
