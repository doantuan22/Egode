import { describe, it, expect } from 'vitest';
import {
  enumerateNights,
  computeRoomTypeAvailability,
  priceRoomLine,
  buildBookedByDate,
  toDateKey,
  type NightlyRate,
} from './availability';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('enumerateNights', () => {
  it('excludes the checkout date (checkout is not a night of stay)', () => {
    const nights = enumerateNights(d('2026-03-01'), d('2026-03-04'));
    expect(nights).toEqual(['2026-03-01', '2026-03-02', '2026-03-03']);
  });

  it('returns a single night for a 1-night stay', () => {
    expect(enumerateNights(d('2026-03-01'), d('2026-03-02'))).toEqual(['2026-03-01']);
  });

  it('throws on an invalid date range (checkOut <= checkIn)', () => {
    expect(() => enumerateNights(d('2026-03-04'), d('2026-03-04'))).toThrow();
    expect(() => enumerateNights(d('2026-03-05'), d('2026-03-04'))).toThrow();
  });
});

describe('computeRoomTypeAvailability', () => {
  const rate = (giaPhong: number, soLuongPhong: number): NightlyRate => ({ giaPhong, soLuongPhong });

  it('reports full availability when there is no booking at all', () => {
    const nights = enumerateNights(d('2026-03-01'), d('2026-03-03'));
    const rates = new Map([
      ['2026-03-01', rate(500000, 5)],
      ['2026-03-02', rate(500000, 5)],
    ]);
    const result = computeRoomTypeAvailability(nights, rates, new Map());

    expect(result.available).toBe(5);
    expect(result.totalPrice).toBe(1_000_000);
    expect(result.pricePerNight).toEqual([500000, 500000]);
  });

  it('subtracts booked rooms per night', () => {
    const nights = enumerateNights(d('2026-03-01'), d('2026-03-03'));
    const rates = new Map([
      ['2026-03-01', rate(500000, 5)],
      ['2026-03-02', rate(500000, 5)],
    ]);
    const booked = new Map([
      ['2026-03-01', 2],
      ['2026-03-02', 4],
    ]);
    const result = computeRoomTypeAvailability(nights, rates, booked);

    // Đêm nút thắt chỉ còn 1 phòng
    expect(result.available).toBe(1);
  });

  it('never goes negative when overbooked beyond inventory', () => {
    const nights = enumerateNights(d('2026-03-01'), d('2026-03-02'));
    const rates = new Map([['2026-03-01', rate(500000, 2)]]);
    const booked = new Map([['2026-03-01', 99]]);
    const result = computeRoomTypeAvailability(nights, rates, booked);

    expect(result.available).toBe(0);
  });

  it('is sold out (available = 0) when a night has no QUY_PHONG_GIA row at all', () => {
    const nights = enumerateNights(d('2026-03-01'), d('2026-03-03'));
    const rates = new Map([['2026-03-01', rate(500000, 5)]]);
    const result = computeRoomTypeAvailability(nights, rates, new Map());

    expect(result.available).toBe(0);
    expect(result.totalPrice).toBeNull();
  });

  it('excludes cancelled bookings from occupied inventory (via buildBookedByDate)', () => {
    const nights = enumerateNights(d('2026-03-01'), d('2026-03-02'));
    const rates = new Map([['2026-03-01', rate(500000, 3)]]);

    // Đơn đã hủy không được đưa vào danh sách đầu vào
    const activeOnly = buildBookedByDate([
      { ngayNhanPhong: d('2026-03-01'), ngayTraPhong: d('2026-03-02'), soLuongPhong: 1 },
    ]);
    const result = computeRoomTypeAvailability(nights, rates, activeOnly);
    expect(result.available).toBe(2);
  });
});

describe('buildBookedByDate', () => {
  it('spreads a multi-night booking across each of its nights, excluding checkout day', () => {
    const map = buildBookedByDate([
      { ngayNhanPhong: d('2026-03-01'), ngayTraPhong: d('2026-03-04'), soLuongPhong: 2 },
    ]);
    expect(map.get('2026-03-01')).toBe(2);
    expect(map.get('2026-03-02')).toBe(2);
    expect(map.get('2026-03-03')).toBe(2);
    expect(map.has('2026-03-04')).toBe(false);
  });

  it('sums overlapping bookings on the same night', () => {
    const map = buildBookedByDate([
      { ngayNhanPhong: d('2026-03-01'), ngayTraPhong: d('2026-03-03'), soLuongPhong: 1 },
      { ngayNhanPhong: d('2026-03-02'), ngayTraPhong: d('2026-03-05'), soLuongPhong: 3 },
    ]);
    expect(map.get('2026-03-01')).toBe(1);
    expect(map.get('2026-03-02')).toBe(4);
    expect(map.get('2026-03-03')).toBe(3);
    expect(map.get('2026-03-04')).toBe(3);
  });
});

describe('priceRoomLine', () => {
  const rate = (giaPhong: number, soLuongPhong: number): NightlyRate => ({ giaPhong, soLuongPhong });

  it('prices a fully-available line for the requested quantity', () => {
    const nights = enumerateNights(d('2026-03-01'), d('2026-03-03'));
    const rates = new Map([
      ['2026-03-01', rate(500000, 5)],
      ['2026-03-02', rate(500000, 5)],
    ]);
    const result = priceRoomLine(nights, rates, new Map(), 2);

    expect(result.available).toBe(5);
    expect(result.duPhong).toBe(true);
    expect(result.coGiaDayDu).toBe(true);
    expect(result.giaTheoDem).toBe(500000);
    expect(result.thanhTien).toBe(2_000_000);
  });

  it('flags DuPhong=false when requested quantity exceeds what remains', () => {
    const nights = enumerateNights(d('2026-03-01'), d('2026-03-02'));
    const rates = new Map([['2026-03-01', rate(500000, 1)]]);
    const result = priceRoomLine(nights, rates, new Map(), 2);

    expect(result.available).toBe(1);
    expect(result.duPhong).toBe(false);
    expect(result.coGiaDayDu).toBe(true);
    expect(result.thanhTien).toBe(1_000_000);
  });

  it('returns null price when any night in range is unpriced', () => {
    const nights = enumerateNights(d('2026-03-01'), d('2026-03-03'));
    const rates = new Map([['2026-03-01', rate(500000, 5)]]);
    const result = priceRoomLine(nights, rates, new Map(), 1);

    expect(result.coGiaDayDu).toBe(false);
    expect(result.giaTheoDem).toBeNull();
    expect(result.thanhTien).toBeNull();
  });
});

describe('toDateKey', () => {
  it('formats as YYYY-MM-DD regardless of time-of-day component', () => {
    expect(toDateKey(new Date('2026-03-01T23:59:59.000Z'))).toBe('2026-03-01');
    expect(toDateKey(new Date('2026-03-01T00:00:00.000Z'))).toBe('2026-03-01');
  });
});
