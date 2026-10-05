import { describe, expect, it } from 'vitest';
import { computeRefundAmountPreview, hoursBeforeCheckIn, selectRefundPercentPreview } from './refund-preview';

const tiers = [
  { SoGioTruocNhanPhong: 72, TyLeHoanTien: 100 },
  { SoGioTruocNhanPhong: 24, TyLeHoanTien: 50 },
];

describe('hoursBeforeCheckIn measures to the instant the server sends (check-in date + hotel time, Vietnam)', () => {
  // Check-in 15 June 2030 at 14:00 Vietnam time = 07:00 UTC.
  const checkIn = '2030-06-15T07:00:00.000Z';

  it('is exact to the minute, regardless of the browser time zone', () => {
    expect(hoursBeforeCheckIn(checkIn, new Date('2030-06-12T07:00:00Z'))).toBe(72);
    expect(hoursBeforeCheckIn(checkIn, new Date('2030-06-14T07:00:00Z'))).toBe(24);
    expect(hoursBeforeCheckIn(checkIn, new Date('2030-06-15T09:00:00Z'))).toBe(-2);
  });

  it('puts the 72 h line at 07:00 UTC three days before — not at 00:00 UTC of the stay date', () => {
    const justBefore = new Date('2030-06-12T06:59:00Z');
    const justAfter = new Date('2030-06-12T07:01:00Z');
    expect(selectRefundPercentPreview(tiers, hoursBeforeCheckIn(checkIn, justBefore))).toBe(100);
    expect(selectRefundPercentPreview(tiers, hoursBeforeCheckIn(checkIn, justAfter))).toBe(50);
  });

  it('after check-in began nothing is refunded', () => {
    expect(selectRefundPercentPreview(tiers, hoursBeforeCheckIn(checkIn, new Date('2030-06-15T08:00:00Z')))).toBe(0);
  });
});

describe('the refund amount preview', () => {
  it('rounds to the dong and never exceeds what was paid', () => {
    expect(computeRefundAmountPreview(1_000_001, 50)).toBe(500_001);
    expect(computeRefundAmountPreview(1_000_000, 100)).toBe(1_000_000);
    expect(computeRefundAmountPreview(1_000_000, 150)).toBe(1_000_000);
  });
});
