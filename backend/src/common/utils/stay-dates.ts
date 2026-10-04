import type { RefinementCtx } from 'zod';

/**
 * The one place that decides whether a stay's dates are acceptable. Search, room availability, quote
 * and booking all validate through here, so the rule cannot drift between endpoints.
 *
 *   checkIn  >= today (business time zone)        checkOut > checkIn
 *   1 <= nights <= MAX_NIGHTS                     checkIn  <= today + MAX_ADVANCE_DAYS
 *
 * "Today" is the calendar day in Asia/Ho_Chi_Minh, never the UTC day: between 00:00 and 07:00 Vietnam
 * time the UTC date is still yesterday. Stay dates themselves are date-only values (a `YYYY-MM-DD`
 * parses to UTC midnight of that day), so they are compared by their UTC calendar day, exactly like
 * `enumerateNights` does. Everything below works on day numbers, never on a per-night loop, so a
 * ridiculous range is rejected in O(1) before anything iterates it.
 */
export const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const MAX_NIGHTS = 30;
export const MAX_ADVANCE_DAYS = 365;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const businessDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's calendar date in the business time zone, as `YYYY-MM-DD`. */
export const businessToday = (now: Date = new Date()): string => businessDateFormat.format(now);

/** Whole days since the epoch of a Date's UTC calendar day. */
const utcDayNumber = (date: Date): number => Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / MS_PER_DAY);

const keyDayNumber = (key: string): number => Math.floor(Date.parse(`${key}T00:00:00Z`) / MS_PER_DAY);

/** `YYYY-MM-DD` shifted by a number of days (negative = earlier). */
export const addDaysToDateKey = (key: string, days: number): string =>
  new Date(Date.parse(`${key}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);

export interface StayDateIssue {
  path: 'checkIn' | 'checkOut';
  message: string;
}

export const STAY_DATE_MESSAGES = {
  checkInPast: 'Ngày nhận phòng không được trước hôm nay',
  checkInTooFar: `Ngày nhận phòng không được quá ${MAX_ADVANCE_DAYS} ngày kể từ hôm nay`,
  checkOutNotAfter: 'Ngày trả phòng phải sau ngày nhận phòng',
  tooManyNights: `Mỗi lần đặt tối đa ${MAX_NIGHTS} đêm`,
} as const;

/** Every rule the given dates break (empty = acceptable). `now` is injectable for boundary tests. */
export const findStayDateIssues = (checkIn: Date, checkOut: Date, now: Date = new Date()): StayDateIssue[] => {
  const issues: StayDateIssue[] = [];
  const today = keyDayNumber(businessToday(now));
  const start = utcDayNumber(checkIn);
  const end = utcDayNumber(checkOut);

  if (start < today) issues.push({ path: 'checkIn', message: STAY_DATE_MESSAGES.checkInPast });
  if (start > today + MAX_ADVANCE_DAYS) issues.push({ path: 'checkIn', message: STAY_DATE_MESSAGES.checkInTooFar });
  if (end <= start) issues.push({ path: 'checkOut', message: STAY_DATE_MESSAGES.checkOutNotAfter });
  else if (end - start > MAX_NIGHTS) issues.push({ path: 'checkOut', message: STAY_DATE_MESSAGES.tooManyNights });
  return issues;
};

/** `superRefine` callback shared by every schema that carries a `checkIn`/`checkOut` pair. */
export const refineStayDates = (data: { checkIn: Date; checkOut: Date }, ctx: RefinementCtx): void => {
  for (const issue of findStayDateIssues(data.checkIn, data.checkOut)) {
    ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
  }
};
