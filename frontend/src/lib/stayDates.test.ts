import { describe, expect, it } from 'vitest';
import { searchFormSchema } from '../features/hotels/schemas';
import {
  addDaysToDateKey,
  businessToday,
  findStayDateIssue,
  latestCheckIn,
  latestCheckOut,
  MAX_ADVANCE_DAYS,
  MAX_NIGHTS,
  STAY_DATE_MESSAGES,
} from './stayDates';

const now = new Date('2026-03-10T12:00:00Z'); // business today = 2026-03-10
const issue = (checkIn: string, checkOut: string, at: Date = now) => findStayDateIssue(checkIn, checkOut, at)?.message ?? null;

describe('businessToday follows Vietnam time', () => {
  it('rolls over at 17:00 UTC', () => {
    expect(businessToday(new Date('2026-03-10T16:59:59Z'))).toBe('2026-03-10');
    expect(businessToday(new Date('2026-03-10T17:00:00Z'))).toBe('2026-03-11');
  });
});

describe('findStayDateIssue mirrors the backend rule', () => {
  it('rejects yesterday, accepts today', () => {
    expect(issue('2026-03-09', '2026-03-11')).toBe(STAY_DATE_MESSAGES.checkInPast);
    expect(issue('2026-03-10', '2026-03-11')).toBeNull();
  });

  it('rejects checkOut <= checkIn', () => {
    expect(issue('2026-03-12', '2026-03-12')).toBe(STAY_DATE_MESSAGES.checkOutNotAfter);
    expect(issue('2026-03-12', '2026-03-11')).toBe(STAY_DATE_MESSAGES.checkOutNotAfter);
  });

  it('allows 1 and 30 nights, rejects 31', () => {
    expect(MAX_NIGHTS).toBe(30);
    expect(issue('2026-03-12', '2026-03-13')).toBeNull();
    expect(issue('2026-03-12', latestCheckOut('2026-03-12'))).toBeNull();
    expect(issue('2026-03-12', addDaysToDateKey('2026-03-12', 31))).toBe(STAY_DATE_MESSAGES.tooManyNights);
  });

  it('allows a check-in 365 days ahead, rejects 366', () => {
    expect(MAX_ADVANCE_DAYS).toBe(365);
    const last = latestCheckIn(now);
    expect(last).toBe(addDaysToDateKey('2026-03-10', 365));
    expect(issue(last, addDaysToDateKey(last, 1))).toBeNull();
    const beyond = addDaysToDateKey(last, 1);
    expect(issue(beyond, addDaysToDateKey(beyond, 1))).toBe(STAY_DATE_MESSAGES.checkInTooFar);
  });

  it('turns over at Vietnam midnight, not UTC midnight', () => {
    expect(issue('2026-03-10', '2026-03-11', new Date('2026-03-10T16:59:59Z'))).toBeNull();
    expect(issue('2026-03-10', '2026-03-11', new Date('2026-03-10T17:00:00Z'))).toBe(STAY_DATE_MESSAGES.checkInPast);
  });

  it('leaves empty values to the required-field checks', () => {
    expect(issue('', '')).toBeNull();
    expect(issue('2026-03-12', '')).toBeNull();
  });
});

describe('searchFormSchema applies the same rule (real clock)', () => {
  const today = businessToday();
  const parse = (checkIn: string, checkOut: string) => searchFormSchema.safeParse({ checkIn, checkOut, guests: 2 });

  it('accepts tomorrow → day after, and a 30-night stay', () => {
    expect(parse(addDaysToDateKey(today, 1), addDaysToDateKey(today, 2)).success).toBe(true);
    expect(parse(addDaysToDateKey(today, 1), addDaysToDateKey(today, 31)).success).toBe(true);
  });

  it('rejects the past, an inverted range and 31 nights, with the backend wording', () => {
    const messages = (a: string, b: string) => {
      const result = parse(a, b);
      return result.success ? [] : result.error.issues.map((i) => i.message);
    };
    expect(messages(addDaysToDateKey(today, -1), today)).toEqual([STAY_DATE_MESSAGES.checkInPast]);
    expect(messages(addDaysToDateKey(today, 3), addDaysToDateKey(today, 3))).toEqual([STAY_DATE_MESSAGES.checkOutNotAfter]);
    expect(messages(addDaysToDateKey(today, 1), addDaysToDateKey(today, 32))).toEqual([STAY_DATE_MESSAGES.tooManyNights]);
  });
});
