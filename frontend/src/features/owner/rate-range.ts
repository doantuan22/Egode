import type { RateItemInput } from './types';

/** Các ngày trong tuần, bắt đầu từ thứ Hai */
export const WEEKDAYS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: 'T2' },
  { value: 2, label: 'T3' },
  { value: 3, label: 'T4' },
  { value: 4, label: 'T5' },
  { value: 5, label: 'T6' },
  { value: 6, label: 'T7' },
  { value: 0, label: 'CN' },
];
export const ALL_WEEKDAYS: readonly number[] = WEEKDAYS.map((day) => day.value);

const DAY_MS = 86_400_000;
const utcMidnight = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** Số ngày từ ngày đầu đến ngày cuối, gồm cả hai */
export const countDays = (from: string, to: string): number => Math.floor((utcMidnight(to) - utcMidnight(from)) / DAY_MS) + 1;

/** Mỗi ngày thuộc thứ đã chọn thành một dòng giá */
export function buildRatePayload({
  from,
  to,
  weekdays,
  price,
  quantity,
  status,
  onlyDates,
}: {
  from: string;
  to: string;
  weekdays: readonly number[];
  price?: number;
  quantity?: number;
  status: string;
  onlyDates?: ReadonlySet<string>;
}): RateItemInput[] {
  const rows: RateItemInput[] = [];
  for (let index = 0; index < countDays(from, to); index++) {
    const day = new Date(utcMidnight(from) + index * DAY_MS);
    if (!weekdays.includes(day.getUTCDay())) continue;
    const date = day.toISOString().slice(0, 10);
    if (onlyDates && !onlyDates.has(date)) continue;
    rows.push({
      NgayApDung: date,
      ...(price === undefined ? {} : { GiaPhong: price }),
      ...(quantity === undefined ? {} : { SoLuongPhong: quantity }),
      TrangThai: status,
    });
  }
  return rows;
}
