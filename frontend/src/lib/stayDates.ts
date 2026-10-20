/** Quy tắc ngày lưu trú phản chiếu từ backend */
export const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const MAX_NIGHTS = 30;
export const MAX_ADVANCE_DAYS = 365;

export const STAY_DATE_MESSAGES = {
  checkInPast: 'Ngày nhận phòng không được trước hôm nay',
  checkInTooFar: `Ngày nhận phòng không được quá ${MAX_ADVANCE_DAYS} ngày kể từ hôm nay`,
  checkOutNotAfter: 'Ngày trả phòng phải sau ngày nhận phòng',
  tooManyNights: `Mỗi lần đặt tối đa ${MAX_NIGHTS} đêm`,
} as const;

const MS_PER_DAY = 86_400_000;

const businessDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Hôm nay ở Việt Nam */
export const businessToday = (now: Date = new Date()): string => businessDateFormat.format(now);

const dayNumber = (key: string): number => Math.floor(Date.parse(`${key}T00:00:00Z`) / MS_PER_DAY);

export const addDaysToDateKey = (key: string, days: number): string =>
  new Date(Date.parse(`${key}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);

/** Ngày nhận phòng muộn nhất */
export const latestCheckIn = (now: Date = new Date()): string => addDaysToDateKey(businessToday(now), MAX_ADVANCE_DAYS);

/** Ngày trả phòng muộn nhất theo ngày nhận */
export const latestCheckOut = (checkIn: string): string => addDaysToDateKey(checkIn, MAX_NIGHTS);

export interface StayDateIssue {
  field: 'checkIn' | 'checkOut';
  message: string;
}

/** Quy tắc đầu tiên bị vi phạm, hoặc null */
export function findStayDateIssue(checkIn: string, checkOut: string, now: Date = new Date()): StayDateIssue | null {
  if (!checkIn || !checkOut) return null;
  const today = dayNumber(businessToday(now));
  const start = dayNumber(checkIn);
  const end = dayNumber(checkOut);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;

  if (start < today) return { field: 'checkIn', message: STAY_DATE_MESSAGES.checkInPast };
  if (start > today + MAX_ADVANCE_DAYS) return { field: 'checkIn', message: STAY_DATE_MESSAGES.checkInTooFar };
  if (end <= start) return { field: 'checkOut', message: STAY_DATE_MESSAGES.checkOutNotAfter };
  if (end - start > MAX_NIGHTS) return { field: 'checkOut', message: STAY_DATE_MESSAGES.tooManyNights };
  return null;
}
