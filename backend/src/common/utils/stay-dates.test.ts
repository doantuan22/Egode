import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  addDaysToDateKey,
  businessToday,
  findStayDateIssues,
  MAX_ADVANCE_DAYS,
  MAX_NIGHTS,
  refineStayDates,
  STAY_DATE_MESSAGES,
} from './stay-dates';

const d = (key: string) => new Date(`${key}T00:00:00Z`);

describe('businessToday — the calendar day in Asia/Ho_Chi_Minh (UTC+7), not the UTC day', () => {
  it('is still the previous UTC day at 16:59 UTC and rolls over at 17:00 UTC (= 00:00 in Vietnam)', () => {
    expect(businessToday(new Date('2026-03-10T16:59:59.999Z'))).toBe('2026-03-10');
    expect(businessToday(new Date('2026-03-10T17:00:00.000Z'))).toBe('2026-03-11');
  });

  it('is ahead of UTC for the whole 17:00-24:00 UTC window, including across a month and a year end', () => {
    expect(businessToday(new Date('2026-03-31T23:30:00Z'))).toBe('2026-04-01');
    expect(businessToday(new Date('2026-12-31T20:00:00Z'))).toBe('2027-01-01');
  });

  it('equals the UTC day during 00:00-17:00 UTC', () => {
    expect(businessToday(new Date('2026-03-10T00:00:00Z'))).toBe('2026-03-10');
    expect(businessToday(new Date('2026-03-10T12:00:00Z'))).toBe('2026-03-10');
  });
});

describe('addDaysToDateKey', () => {
  it('shifts across month and year boundaries in both directions', () => {
    expect(addDaysToDateKey('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysToDateKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToDateKey('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('findStayDateIssues (now = 2026-03-10 12:00 UTC → business today 2026-03-10)', () => {
  const now = new Date('2026-03-10T12:00:00Z');
  const issues = (checkIn: string, checkOut: string, at: Date = now) => findStayDateIssues(d(checkIn), d(checkOut), at).map((i) => i.message);

  it('rejects a check-in in the past', () => {
    expect(issues('2026-03-09', '2026-03-11')).toEqual([STAY_DATE_MESSAGES.checkInPast]);
  });

  it('accepts a check-in today', () => {
    expect(issues('2026-03-10', '2026-03-11')).toEqual([]);
  });

  it('rejects checkOut equal to checkIn and checkOut before checkIn', () => {
    expect(issues('2026-03-12', '2026-03-12')).toEqual([STAY_DATE_MESSAGES.checkOutNotAfter]);
    expect(issues('2026-03-12', '2026-03-10')).toEqual([STAY_DATE_MESSAGES.checkOutNotAfter]);
  });

  it('accepts 1 night and exactly MAX_NIGHTS nights, rejects MAX_NIGHTS + 1', () => {
    expect(MAX_NIGHTS).toBe(30);
    expect(issues('2026-03-12', '2026-03-13')).toEqual([]);
    expect(issues('2026-03-12', addDaysToDateKey('2026-03-12', 30))).toEqual([]);
    expect(issues('2026-03-12', addDaysToDateKey('2026-03-12', 31))).toEqual([STAY_DATE_MESSAGES.tooManyNights]);
  });

  it('accepts a check-in exactly 365 days ahead, rejects 366', () => {
    expect(MAX_ADVANCE_DAYS).toBe(365);
    const limit = addDaysToDateKey('2026-03-10', 365);
    expect(issues(limit, addDaysToDateKey(limit, 1))).toEqual([]);
    const beyond = addDaysToDateKey('2026-03-10', 366);
    expect(issues(beyond, addDaysToDateKey(beyond, 1))).toEqual([STAY_DATE_MESSAGES.checkInTooFar]);
  });

  it('rejects a multi-year range in constant time without iterating it', () => {
    const started = Date.now();
    expect(issues('2026-03-10', '9999-12-31')).toEqual([STAY_DATE_MESSAGES.tooManyNights]);
    expect(issues('1990-01-01', '2090-01-01').length).toBeGreaterThan(0);
    expect(Date.now() - started).toBeLessThan(50);
  });

  describe('boundary around 00:00 Vietnam time (17:00 UTC)', () => {
    it('one second before Vietnam midnight, "today" is still the old day', () => {
      const before = new Date('2026-03-10T16:59:59Z'); // 23:59:59 on 10 March in Vietnam
      expect(issues('2026-03-10', '2026-03-11', before)).toEqual([]);
    });

    it('right after Vietnam midnight, the old day is already in the past — even though the UTC date is still the 10th', () => {
      const after = new Date('2026-03-10T17:00:00Z'); // 00:00:00 on 11 March in Vietnam
      expect(issues('2026-03-10', '2026-03-11', after)).toEqual([STAY_DATE_MESSAGES.checkInPast]);
      expect(issues('2026-03-11', '2026-03-12', after)).toEqual([]);
    });

    it('the 365-day horizon moves with the Vietnam day, not the UTC day', () => {
      const lateUtc = new Date('2026-03-10T20:00:00Z'); // already 11 March in Vietnam
      const lastAllowed = addDaysToDateKey('2026-03-11', 365);
      expect(issues(lastAllowed, addDaysToDateKey(lastAllowed, 1), lateUtc)).toEqual([]);
      const tooFar = addDaysToDateKey('2026-03-11', 366);
      expect(issues(tooFar, addDaysToDateKey(tooFar, 1), lateUtc)).toEqual([STAY_DATE_MESSAGES.checkInTooFar]);
    });
  });
});

describe('refineStayDates (zod)', () => {
  const schema = z.object({ checkIn: z.coerce.date(), checkOut: z.coerce.date() }).superRefine(refineStayDates);
  const today = businessToday();

  it('attaches each message to the field that is wrong', () => {
    const past = schema.safeParse({ checkIn: addDaysToDateKey(today, -1), checkOut: today });
    expect(past.success).toBe(false);
    if (!past.success) expect(past.error.issues.map((i) => [i.path[0], i.message])).toEqual([['checkIn', STAY_DATE_MESSAGES.checkInPast]]);

    const inverted = schema.safeParse({ checkIn: addDaysToDateKey(today, 5), checkOut: addDaysToDateKey(today, 5) });
    expect(inverted.success).toBe(false);
    if (!inverted.success) expect(inverted.error.issues.map((i) => [i.path[0], i.message])).toEqual([['checkOut', STAY_DATE_MESSAGES.checkOutNotAfter]]);
  });

  it('accepts a normal stay', () => {
    expect(schema.safeParse({ checkIn: addDaysToDateKey(today, 1), checkOut: addDaysToDateKey(today, 3) }).success).toBe(true);
  });
});
