import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { createTestAccount, createTestDiaPhuong, createTestHotel, createTestRoomType, deleteTestAccount, deleteTestDiaPhuong, deleteTestHotel } from '../../test/factories';
import { getPrismaClient } from '../../config/prisma';
import { ROLE_NAMES } from '../../common/constants/roles';
import { addDaysToDateKey, businessToday } from '../../common/utils/stay-dates';

/**
 * Bug #20 — `starRating=N` is a MINIMUM: hotels with HangSao >= N. The UI says "Từ N sao trở lên"; these tests pin the
 * API behaviour that wording promises (3 → 3,4,5 · 4 → 4,5 · 5 → only 5), so the label and the data cannot drift apart.
 */
const day = (n: number) => addDaysToDateKey(businessToday(), n);
const prisma = () => getPrismaClient();
let ownerId = 0;
let diaPhuongId = 0;
let cityName = '';
const hotelByStars = new Map<number, number>(); // HangSao → MaKhachSan

beforeAll(async () => {
  const owner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  ownerId = owner.account.MaTaiKhoan;
  const dp = await createTestDiaPhuong();
  diaPhuongId = dp.MaDiaPhuong;
  cityName = dp.TenThanhPho;
  for (const stars of [1, 2, 3, 4, 5]) {
    const hotel = await createTestHotel(ownerId, diaPhuongId);
    await prisma().kHACH_SAN.update({ where: { MaKhachSan: hotel.MaKhachSan }, data: { HangSao: stars } });
    const roomType = await createTestRoomType(hotel.MaKhachSan);
    await prisma().qUY_PHONG_GIA.create({ data: { MaLoaiPhong: roomType.MaLoaiPhong, NgayApDung: new Date(`${day(1)}T00:00:00Z`), GiaPhong: 100000, SoLuongPhong: 2, TrangThai: 'Mở bán' } });
    hotelByStars.set(stars, hotel.MaKhachSan);
  }
});

afterAll(async () => {
  for (const id of hotelByStars.values()) await deleteTestHotel(id);
  await deleteTestAccount(ownerId);
  await deleteTestDiaPhuong(diaPhuongId);
});

/** The star ratings of the test city's hotels that the search returns. */
const starsFor = async (starRating?: number | string) => {
  const res = await request(app).get('/api/hotels').query({ location: cityName, checkIn: day(1), checkOut: day(2), guests: 1, ...(starRating === undefined ? {} : { starRating }) });
  expect(res.status).toBe(200);
  return (res.body.data as Array<{ HangSao: number }>).map((h) => h.HangSao).sort();
};

describe('GET /api/hotels?starRating=N means "from N stars up"', () => {
  it('starRating=3 → 3, 4 and 5 star hotels (not only exactly 3)', async () => {
    expect(await starsFor(3)).toEqual([3, 4, 5]);
  });

  it('starRating=4 → 4 and 5 star hotels', async () => {
    expect(await starsFor(4)).toEqual([4, 5]);
  });

  it('starRating=5 → only 5 star hotels', async () => {
    expect(await starsFor(5)).toEqual([5]);
  });

  it('no starRating → every star level; starRating=1 is the same as no filter', async () => {
    expect(await starsFor()).toEqual([1, 2, 3, 4, 5]);
    expect(await starsFor(1)).toEqual([1, 2, 3, 4, 5]);
  });

  it('the rating combines with the other filters instead of replacing them', async () => {
    const res = await request(app).get('/api/hotels').query({ location: cityName, checkIn: day(1), checkOut: day(2), guests: 1, starRating: 4, minPrice: 99999999 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it.each([0, 6, -1, 'abc', '3.5'])('rejects starRating=%s with 400 VALIDATION_ERROR', async (value) => {
    const res = await request(app).get('/api/hotels').query({ location: cityName, starRating: value });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
