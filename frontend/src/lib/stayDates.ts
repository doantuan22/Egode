/**
 * Stay-date rule, mirrored from backend/src/common/utils/stay-dates.ts (the backend is the authority —
 * this only lets the UI refuse a bad range before a round trip and keep the same wording):
 *
 *   checkIn >= today (Asia/Ho_Chi_Minh)    checkOut > checkIn
 *   1 <= nights <= 30                      checkIn <= today + 365 days
 *
 * "Today" is the calendar day in Vietnam, not the browser's day, so a visitor in another time zone sees
 * the same boundary the server enforces. All values are `YYYY-MM-DD` strings.
 */
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

/** Today's date in Vietnam as `YYYY-MM-DD`. */
export const businessToday = (now: Date = new Date()): string => businessDateFormat.format(now);

const dayNumber = (key: string): number => Math.floor(Date.parse(`${key}T00:00:00Z`) / MS_PER_DAY);

export const addDaysToDateKey = (key: string, days: number): string =>
  new Date(Date.parse(`${key}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);

/** Latest check-in the booking window allows. */
export const latestCheckIn = (now: Date = new Date()): string => addDaysToDateKey(businessToday(now), MAX_ADVANCE_DAYS);

/** Latest check-out for a given check-in (MAX_NIGHTS nights later). */
export const latestCheckOut = (checkIn: string): string => addDaysToDateKey(checkIn, MAX_NIGHTS);

export interface StayDateIssue {
  field: 'checkIn' | 'checkOut';
  message: string;
}

/** The first rule the dates break, or null. Empty values are left to the "required" checks. */
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
