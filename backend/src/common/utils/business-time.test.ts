import { describe, it, expect } from 'vitest';
import {
  addDaysToDateKey,
  businessDayStart,
  businessInstant,
  businessToday,
  checkInInstant,
  checkOutInstant,
  dateKeyOf,
  hoursUntil,
  timeOfDayOf,
} from './business-time';

/** Date/time columns as Prisma returns them: DATE → UTC midnight of the day, TIME → 1970-01-01T<HH:mm>Z. */
const dateColumn = (key: string) => new Date(`${key}T00:00:00Z`);
const timeColumn = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);

describe('reading database date / time columns', () => {
  it('a DATE column is a calendar day, a TIME column is a wall-clock time', () => {
    expect(dateKeyOf(dateColumn('2026-03-10'))).toBe('2026-03-10');
    expect(timeOfDayOf(timeColumn('14:00'))).toBe('14:00');
    expect(timeOfDayOf(timeColumn('09:30'))).toBe('09:30');
  });
});

describe('check-in / check-out are INSTANTS in Vietnam time (UTC+7), not midnight UTC', () => {
  it('check-in 14:00 on 10 March is 07:00 UTC that day', () => {
    expect(checkInInstant(dateColumn('2026-03-10'), timeColumn('14:00')).toISOString()).toBe('2026-03-10T07:00:00.000Z');
  });

  it('an early check-in time falls on the previous UTC day', () => {
    expect(checkInInstant(dateColumn('2026-03-10'), timeColumn('06:00')).toISOString()).toBe('2026-03-09T23:00:00.000Z');
  });

  it('check-out 12:00 is 05:00 UTC', () => {
    expect(checkOutInstant(dateColumn('2026-03-12'), timeColumn('12:00')).toISOString()).toBe('2026-03-12T05:00:00.000Z');
  });

  it('works across a month and year end', () => {
    expect(checkInInstant(dateColumn('2027-01-01'), timeColumn('00:30')).toISOString()).toBe('2026-12-31T17:30:00.000Z');
  });

  it('businessInstant / businessDayStart agree with each other', () => {
    expect(businessInstant('2026-03-10', '00:00').getTime()).toBe(businessDayStart('2026-03-10').getTime());
    expect(businessDayStart('2026-03-10').toISOString()).toBe('2026-03-09T17:00:00.000Z');
  });
});

describe('hoursUntil', () => {
  it('is positive before the instant, zero at it, negative after', () => {
    const instant = new Date('2026-03-10T07:00:00Z');
    expect(hoursUntil(instant, new Date('2026-03-07T07:00:00Z'))).toBe(72);
    expect(hoursUntil(instant, instant)).toBe(0);
    expect(hoursUntil(instant, new Date('2026-03-10T09:30:00Z'))).toBe(-2.5);
  });

  it('the 72 h cut-off of a 14:00 check-in falls at 07:00 UTC three days earlier — 7 h later than the old 00:00-UTC reading', () => {
    const checkIn = checkInInstant(dateColumn('2026-03-10'), timeColumn('14:00'));
    expect(hoursUntil(checkIn, new Date('2026-03-07T06:59:00Z'))).toBeGreaterThan(72);
    expect(hoursUntil(checkIn, new Date('2026-03-07T07:01:00Z'))).toBeLessThan(72);
  });
});

describe('business calendar helpers', () => {
  it('"today" rolls over at 17:00 UTC', () => {
    expect(businessToday(new Date('2026-03-10T16:59:59Z'))).toBe('2026-03-10');
    expect(businessToday(new Date('2026-03-10T17:00:00Z'))).toBe('2026-03-11');
  });

  it('addDaysToDateKey crosses month and year boundaries', () => {
    expect(addDaysToDateKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToDateKey('2026-03-01', -1)).toBe('2026-02-28');
  });
});
