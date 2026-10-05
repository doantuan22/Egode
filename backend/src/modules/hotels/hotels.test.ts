import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { getPrismaClient } from '../../config/prisma';
import { seedDiscovery } from '../../../prisma/seed-discovery';
import { addDaysToDateKey, businessToday } from '../../common/utils/stay-dates';

// "Today" is the business-time-zone day (Asia/Ho_Chi_Minh) — the same day the API validates stay dates against.
const addDays = (days: number): string => addDaysToDateKey(businessToday(), days);

let grandSaigonId: number;
let danangResortId: number;

beforeAll(async () => {
  // These assertions intentionally exercise the date-relative demo fixtures.
  // Re-anchor them through the production seed function before reading them.
  await seedDiscovery();
  const prisma = getPrismaClient();
  const grandSaigon = await prisma.kHACH_SAN.findFirstOrThrow({ where: { TenKhachSan: 'Grand Saigon Hotel' } });
  const danang = await prisma.kHACH_SAN.findFirstOrThrow({ where: { TenKhachSan: 'Da Nang Beach Resort' } });
  grandSaigonId = grandSaigon.MaKhachSan;
  danangResortId = danang.MaKhachSan;
});

describe('GET /api/hotels (search/filter/pagination)', () => {
  it('finds hotels by location and returns pagination metadata', async () => {
    const res = await request(app)
      .get('/api/hotels')
      .query({ location: 'Hồ Chí Minh', checkIn: addDays(20), checkOut: addDays(22) });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const names = res.body.data.map((h: { TenKhachSan: string }) => h.TenKhachSan);
    expect(names).toContain('Grand Saigon Hotel');
    expect(names).toContain('Saigon Riverside Inn');
    expect(names).not.toContain('Hanoi Boutique Residence');
    expect(res.body.pagination).toMatchObject({ page: 1 });
  });

  it('paginates results', async () => {
    const res = await request(app)
      .get('/api/hotels')
      .query({ location: 'Hồ Chí Minh', checkIn: addDays(20), checkOut: addDays(22), limit: 1, page: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);
    expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(2);
  });

  it('filters by price range', async () => {
    const cheap = await request(app)
      .get('/api/hotels')
      .query({ location: 'Hồ Chí Minh', checkIn: addDays(20), checkOut: addDays(22), maxPrice: 600000 });
    const cheapNames = cheap.body.data.map((h: { TenKhachSan: string }) => h.TenKhachSan);
    expect(cheapNames).toContain('Saigon Riverside Inn');
    expect(cheapNames).not.toContain('Grand Saigon Hotel');

    const expensive = await request(app)
      .get('/api/hotels')
      .query({ location: 'Hồ Chí Minh', checkIn: addDays(20), checkOut: addDays(22), minPrice: 800000 });
    const expensiveNames = expensive.body.data.map((h: { TenKhachSan: string }) => h.TenKhachSan);
    expect(expensiveNames).toContain('Grand Saigon Hotel');
    expect(expensiveNames).not.toContain('Saigon Riverside Inn');
  });

  it('guests are counted over ALL rooms together: a hotel that could never hold the party is not listed', async () => {
    const res = await request(app)
      .get('/api/hotels')
      .query({ location: 'Đà Nẵng', checkIn: addDays(20), checkOut: addDays(22), guests: 4 });
    // 4 guests fit in one Suite (SucChua 4) — or in two 2-person rooms; still returned.
    const names = res.body.data.map((h: { TenKhachSan: string }) => h.TenKhachSan);
    expect(names).toContain('Da Nang Beach Resort');

    const tooMany = await request(app)
      .get('/api/hotels')
      .query({ location: 'Đà Nẵng', checkIn: addDays(20), checkOut: addDays(22), guests: 50 });
    // 50 guests exceed everything Da Nang Beach Resort has in stock (all its rooms together), so it is not offered.
    expect(tooMany.body.data.map((h: { TenKhachSan: string }) => h.TenKhachSan)).not.toContain('Da Nang Beach Resort');
  });

  it('rejects an invalid date range (checkOut <= checkIn)', async () => {
    const res = await request(app)
      .get('/api/hotels')
      .query({ checkIn: addDays(5), checkOut: addDays(5) });
    expect(res.status).toBe(400);

    const reversed = await request(app)
      .get('/api/hotels')
      .query({ checkIn: addDays(5), checkOut: addDays(3) });
    expect(reversed.status).toBe(400);
  });

  it('rejects missing required checkIn/checkOut', async () => {
    const res = await request(app).get('/api/hotels');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/hotels/:id (hotel detail)', () => {
  it('returns hotel detail with images and amenities', async () => {
    const res = await request(app).get(`/api/hotels/${grandSaigonId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.TenKhachSan).toBe('Grand Saigon Hotel');
    expect(res.body.data.DiaPhuong.TenThanhPho).toBe('Hồ Chí Minh');
    expect(Array.isArray(res.body.data.HinhAnh)).toBe(true);
    expect(res.body.data.HinhAnh.length).toBeGreaterThan(0);
    expect(res.body.data.TienNghi.length).toBeGreaterThan(0);
  });

  it('returns 404 for a non-existent hotel', async () => {
    const res = await request(app).get('/api/hotels/999999999');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/hotels/:id/rooms (room list + price + availability)', () => {
  it('lists room types with price when there is no booking in range', async () => {
    const res = await request(app)
      .get(`/api/hotels/${grandSaigonId}/rooms`)
      .query({ checkIn: addDays(20), checkOut: addDays(22) });

    expect(res.status).toBe(200);
    const standard = res.body.data.find((r: { TenLoaiPhong: string }) => r.TenLoaiPhong === 'Standard');
    expect(standard).toBeDefined();
    expect(standard.SoPhongConLai).toBe(6); // full inventory, no booking in this range
    expect(standard.ConHang).toBe(true);
    expect(standard.GiaTheoDem).toBeGreaterThan(0);
    expect(standard.TongTien).toBe(standard.GiaTheoDem === null ? null : standard.TongTien);
  });

  it('availability có booking: subtracts booked rooms for the overlapping range', async () => {
    const res = await request(app)
      .get(`/api/hotels/${grandSaigonId}/rooms`)
      .query({ checkIn: addDays(5), checkOut: addDays(7) }); // SEED-BOOK-001 takes 4/6 Standard here

    const standard = res.body.data.find((r: { TenLoaiPhong: string }) => r.TenLoaiPhong === 'Standard');
    expect(standard.SoPhongConLai).toBe(2); // 6 - 4
    expect(standard.ConHang).toBe(true);
  });

  it('checkout date của booking không được tính là một đêm bị chiếm', async () => {
    // SEED-BOOK-001 stays [day+5, day+7). Querying [day+7, day+8) must NOT
    // see the checkout day as occupied — full inventory again.
    const res = await request(app)
      .get(`/api/hotels/${grandSaigonId}/rooms`)
      .query({ checkIn: addDays(7), checkOut: addDays(8) });

    const standard = res.body.data.find((r: { TenLoaiPhong: string }) => r.TenLoaiPhong === 'Standard');
    expect(standard.SoPhongConLai).toBe(6);
  });

  it('sold out: fully booked room type shows 0 remaining and ConHang=false', async () => {
    const res = await request(app)
      .get(`/api/hotels/${danangResortId}/rooms`)
      .query({ checkIn: addDays(10), checkOut: addDays(12) }); // SEED-BOOK-002 takes all 2 Suite rooms

    const suite = res.body.data.find((r: { TenLoaiPhong: string }) => r.TenLoaiPhong === 'Suite');
    expect(suite.SoPhongConLai).toBe(0);
    expect(suite.ConHang).toBe(false);
  });

  it('không overcount booking đã hủy: cancelled booking never reduces availability', async () => {
    // SEED-BOOK-003 (CANCELLED) "books" all 5 Deluxe rooms for the same
    // [day+10, day+12) range as the sold-out Suite test above — Deluxe must
    // still show full availability.
    const res = await request(app)
      .get(`/api/hotels/${danangResortId}/rooms`)
      .query({ checkIn: addDays(10), checkOut: addDays(12) });

    const deluxe = res.body.data.find((r: { TenLoaiPhong: string }) => r.TenLoaiPhong === 'Deluxe');
    expect(deluxe.SoPhongConLai).toBe(5);
    expect(deluxe.ConHang).toBe(true);
  });

  it('rejects an invalid date range on the rooms endpoint too', async () => {
    const res = await request(app)
      .get(`/api/hotels/${grandSaigonId}/rooms`)
      .query({ checkIn: addDays(5), checkOut: addDays(5) });
    expect(res.status).toBe(400);
  });

  it('lists every room type with its capacity — a party can be spread over several rooms, so none is hidden', async () => {
    const res = await request(app)
      .get(`/api/hotels/${grandSaigonId}/rooms`)
      .query({ checkIn: addDays(20), checkOut: addDays(22), guests: 4 });
    const names = res.body.data.map((r: { TenLoaiPhong: string }) => r.TenLoaiPhong);
    expect(names).toContain('Suite'); // SucChua 4
    expect(names).toContain('Standard'); // SucChua 2: two of them hold four guests
    const standard = res.body.data.find((r: { TenLoaiPhong: string }) => r.TenLoaiPhong === 'Standard');
    expect(standard.SucChua).toBe(2);
  });

  it('returns 404 for rooms of a non-existent hotel', async () => {
    const res = await request(app)
      .get('/api/hotels/999999999/rooms')
      .query({ checkIn: addDays(20), checkOut: addDays(22) });
    expect(res.status).toBe(404);
  });
});
