import { describe, expect, it } from 'vitest';
import { ALL_WEEKDAYS, buildRatePayload, countDays } from './rate-range';

const base = { price: 700000, quantity: 5, status: 'Mở bán' };

describe('countDays', () => {
  it('counts both ends of the range', () => {
    expect(countDays('2030-01-01', '2030-01-01')).toBe(1);
    expect(countDays('2030-01-01', '2030-01-14')).toBe(14);
    expect(countDays('2030-02-27', '2030-03-02')).toBe(4);
  });
});

describe('buildRatePayload', () => {
  it('gives one row per day of the range when every weekday is selected', () => {
    const rows = buildRatePayload({ ...base, from: '2030-01-01', to: '2030-01-04', weekdays: ALL_WEEKDAYS });

    expect(rows.map((row) => row.NgayApDung)).toEqual(['2030-01-01', '2030-01-02', '2030-01-03', '2030-01-04']);
    expect(rows[0]).toEqual({ NgayApDung: '2030-01-01', GiaPhong: 700000, SoLuongPhong: 5, TrangThai: 'Mở bán' });
  });

  it('keeps only the selected weekdays (2030-01-01 is a Tuesday; 0 = Sunday, 1 = Monday)', () => {
    const rows = buildRatePayload({ ...base, from: '2030-01-01', to: '2030-01-14', weekdays: [6, 0] });

    expect(rows.map((row) => row.NgayApDung)).toEqual(['2030-01-05', '2030-01-06', '2030-01-12', '2030-01-13']);
  });

  it('leaves out the price and quantity when they are not given, so the stored values are kept', () => {
    const rows = buildRatePayload({ from: '2030-01-01', to: '2030-01-02', weekdays: ALL_WEEKDAYS, status: 'Đóng bán' });
    expect(rows).toEqual([
      { NgayApDung: '2030-01-01', TrangThai: 'Đóng bán' },
      { NgayApDung: '2030-01-02', TrangThai: 'Đóng bán' },
    ]);
    expect(buildRatePayload({ from: '2030-01-01', to: '2030-01-01', weekdays: ALL_WEEKDAYS, status: 'Mở bán', price: 1 })[0]).toEqual({
      NgayApDung: '2030-01-01',
      GiaPhong: 1,
      TrangThai: 'Mở bán',
    });
  });

  it('keeps only the days listed in onlyDates', () => {
    const rows = buildRatePayload({
      from: '2030-01-01',
      to: '2030-01-04',
      weekdays: ALL_WEEKDAYS,
      status: 'Đóng bán',
      onlyDates: new Set(['2030-01-02', '2030-01-04']),
    });
    expect(rows.map((row) => row.NgayApDung)).toEqual(['2030-01-02', '2030-01-04']);
  });

  it('is empty when no day of the range falls on a selected weekday', () => {
    expect(buildRatePayload({ ...base, from: '2030-01-01', to: '2030-01-03', weekdays: [1] })).toEqual([]);
  });

  it('does not shift dates across a month or year end', () => {
    const rows = buildRatePayload({ ...base, from: '2029-12-30', to: '2030-01-02', weekdays: ALL_WEEKDAYS });
    expect(rows.map((row) => row.NgayApDung)).toEqual(['2029-12-30', '2029-12-31', '2030-01-01', '2030-01-02']);
  });
});
