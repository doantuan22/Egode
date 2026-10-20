import { describe, it, expect } from 'vitest';
import { selectRefundPercent, computeRefundAmount } from './refund-policy';

const tiers = [
  { soGioTruocNhanPhong: 72, tyLeHoanTien: 100 },
  { soGioTruocNhanPhong: 24, tyLeHoanTien: 50 },
];

describe('selectRefundPercent', () => {
  it('picks the most generous satisfied tier', () => {
    expect(selectRefundPercent(tiers, 200)).toBe(100);
    expect(selectRefundPercent(tiers, 72)).toBe(100);
  });

  it('falls to the lower tier just under the top threshold', () => {
    expect(selectRefundPercent(tiers, 71.9)).toBe(50);
    expect(selectRefundPercent(tiers, 24)).toBe(50);
  });

  it('returns 0% when no tier threshold is met', () => {
    expect(selectRefundPercent(tiers, 23.9)).toBe(0);
    expect(selectRefundPercent(tiers, 0)).toBe(0);
  });

  it('returns 0% for a negative hours-before-check-in (cancelling after check-in already started)', () => {
    expect(selectRefundPercent(tiers, -5)).toBe(0);
  });

  it('is order-independent — same result regardless of input array order', () => {
    const reversed = [...tiers].reverse();
    expect(selectRefundPercent(reversed, 50)).toBe(selectRefundPercent(tiers, 50));
  });

  it('returns 0% for an empty tier list', () => {
    expect(selectRefundPercent([], 1000)).toBe(0);
  });
});

describe('computeRefundAmount', () => {
  it('computes the percentage of the amount paid, rounded', () => {
    expect(computeRefundAmount(1_000_000, 100)).toBe(1_000_000);
    expect(computeRefundAmount(1_000_000, 50)).toBe(500_000);
    expect(computeRefundAmount(999_999, 33)).toBe(Math.round(999_999 * 0.33));
  });

  it('returns 0 for a 0% tier', () => {
    expect(computeRefundAmount(1_000_000, 0)).toBe(0);
  });

  it('never exceeds the amount paid, even if given an out-of-range percent', () => {
    expect(computeRefundAmount(1_000_000, 150)).toBe(1_000_000);
  });
});
