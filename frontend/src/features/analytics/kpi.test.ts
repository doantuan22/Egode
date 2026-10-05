import { describe, expect, it } from 'vitest';
import { changeVersusPrevious, computeKpis, lastDaysRanges } from './kpi';
import type { OwnerAnalytics } from './types';

describe('lastDaysRanges', () => {
  it('returns the last N days and the N days before them, ends included', () => {
    expect(lastDaysRanges(30, '2030-01-31')).toEqual({
      current: { from: '2030-01-02', to: '2030-01-31' },
      previous: { from: '2029-12-03', to: '2030-01-01' },
    });
  });

  it('does not shift a day across a month end or a year end', () => {
    expect(lastDaysRanges(7, '2030-01-03').previous).toEqual({ from: '2029-12-21', to: '2029-12-27' });
  });
});

const analytics = (patch: Partial<OwnerAnalytics>): OwnerAnalytics => ({
  MaKhachSan: 1, From: null, To: null, TongSoBooking: 12, BookingTheoTrangThai: [], DoanhThuGop: 0, TongHoanTien: 0,
  DoanhThuThucNhan: 6_000_000, LoaiPhongPhoBien: [], TyLeLapDay: 40, TongPhongDem: 10, TongPhongCoTheBan: 25, ...patch,
});

describe('computeKpis', () => {
  it('derives ADR and RevPAR from the money received and the room-nights', () => {
    expect(computeKpis(analytics({}))).toEqual({ occupancy: 40, adr: 600_000, revpar: 240_000, newBookings: 12 });
  });

  it('has no ADR without a sold night and no RevPAR without rooms on sale', () => {
    expect(computeKpis(analytics({ TongPhongDem: 0, TongPhongCoTheBan: 0, TyLeLapDay: null }))).toEqual({ occupancy: null, adr: null, revpar: null, newBookings: 12 });
  });
});

describe('changeVersusPrevious', () => {
  it('compares money and counts relatively', () => {
    expect(changeVersusPrevious(110, 100, 'percent', '30 ngày trước')).toEqual({ text: '+10% so với 30 ngày trước', tone: 'good' });
    expect(changeVersusPrevious(75, 100, 'percent', '30 ngày trước')).toEqual({ text: '−25% so với 30 ngày trước', tone: 'bad' });
  });

  it('compares percentages in points', () => {
    expect(changeVersusPrevious(52.5, 50, 'points', 'kỳ trước')).toEqual({ text: '+2,5 điểm % so với kỳ trước', tone: 'good' });
  });

  it('says so when nothing changed', () => {
    expect(changeVersusPrevious(50, 50, 'points', 'kỳ trước')).toEqual({ text: 'Không đổi so với kỳ trước', tone: 'neutral' });
  });

  it('has nothing to compare with when a side is missing or the base is zero', () => {
    expect(changeVersusPrevious(null, 10, 'percent', 'x')).toBeNull();
    expect(changeVersusPrevious(10, null, 'points', 'x')).toBeNull();
    expect(changeVersusPrevious(10, 0, 'percent', 'x')).toBeNull();
  });
});
