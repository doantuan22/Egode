import type { RefinementCtx } from 'zod';
import { businessToday, MS_PER_DAY } from './business-time';

/** Nơi duy nhất kiểm tra ngày lưu trú hợp lệ */
export { BUSINESS_TIME_ZONE, businessToday, addDaysToDateKey } from './business-time';
export const MAX_NIGHTS = 30;
export const MAX_ADVANCE_DAYS = 365;


/** Số ngày kể từ epoch của ngày UTC */
const utcDayNumber = (date: Date): number => Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / MS_PER_DAY);

const keyDayNumber = (key: string): number => Math.floor(Date.parse(`${key}T00:00:00Z`) / MS_PER_DAY);

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

/** Các quy tắc ngày lưu trú bị vi phạm */
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

/** Kiểm tra chéo cho schema có cặp checkIn/checkOut */
export const refineStayDates = (data: { checkIn: Date; checkOut: Date }, ctx: RefinementCtx): void => {
  for (const issue of findStayDateIssues(data.checkIn, data.checkOut)) {
    ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
  }
};
