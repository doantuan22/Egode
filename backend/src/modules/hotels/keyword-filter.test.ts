import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { createTestAccount, createTestDiaPhuong, createTestHotel, createTestRoomType, deleteTestAccount, deleteTestDiaPhuong, deleteTestHotel } from '../../test/factories';
import { getPrismaClient } from '../../config/prisma';
import { ROLE_NAMES } from '../../common/constants/roles';
import { addDaysToDateKey, businessToday } from '../../common/utils/stay-dates';

/** Từ khóa chỉ thu hẹp kết quả */
const day = (n: number) => addDaysToDateKey(businessToday(), n);
const prisma = () => getPrismaClient();
let ownerId = 0;
let diaPhuongId = 0;
let cityName = '';
const hotelIds: number[] = [];
const marker = `Kw${Date.now().toString(36)}`;

beforeAll(async () => {
  const owner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  ownerId = owner.account.MaTaiKhoan;
  const dp = await createTestDiaPhuong();
  diaPhuongId = dp.MaDiaPhuong;
  cityName = dp.TenThanhPho;
  for (const [name, address] of [
    [`Alpha ${marker}`, 'Số 1 đường Biển'],
    [`Beta Hotel`, `Số 2 phố ${marker}`],
  ]) {
    const hotel = await createTestHotel(ownerId, diaPhuongId);
    await prisma().kHACH_SAN.update({ where: { MaKhachSan: hotel.MaKhachSan }, data: { TenKhachSan: name, DiaChiChiTiet: address } });
    const roomType = await createTestRoomType(hotel.MaKhachSan);
    await prisma().qUY_PHONG_GIA.create({ data: { MaLoaiPhong: roomType.MaLoaiPhong, NgayApDung: new Date(`${day(1)}T00:00:00Z`), GiaPhong: 100000, SoLuongPhong: 2, TrangThai: 'Mở bán' } });
    hotelIds.push(hotel.MaKhachSan);
  }
});

afterAll(async () => {
  for (const id of hotelIds) await deleteTestHotel(id);
  await deleteTestAccount(ownerId);
  await deleteTestDiaPhuong(diaPhuongId);
});

const search = async (extra: Record<string, string | number>) => {
  const res = await request(app).get('/api/hotels').query({ checkIn: day(1), checkOut: day(2), guests: 1, ...extra });
  expect(res.status).toBe(200);
  return (res.body.data as Array<{ MaKhachSan: number }>).map((h) => h.MaKhachSan).sort((a, b) => a - b);
};

describe('GET /api/hotels?keyword=…', () => {
  it('matches the hotel name or the address', async () => {
    expect(await search({ keyword: marker })).toEqual([...hotelIds].sort((a, b) => a - b));
    expect(await search({ keyword: `Alpha ${marker}` })).toEqual([hotelIds[0]]);
    expect(await search({ keyword: `phố ${marker}` })).toEqual([hotelIds[1]]);
  });

  it('matches the city of the hotel', async () => {
    const ids = await search({ keyword: cityName });
    expect(ids).toEqual(expect.arrayContaining(hotelIds));
  });

  it('narrows together with the other filters and finds nothing for an unknown word', async () => {
    expect(await search({ keyword: marker, location: cityName })).toEqual([...hotelIds].sort((a, b) => a - b));
    expect(await search({ keyword: marker, minPrice: 99999999 })).toEqual([]);
    expect(await search({ keyword: `khong-co-${marker}` })).toEqual([]);
  });

  it('is optional: an empty keyword is the same as none, and one over 100 characters is rejected', async () => {
    const none = await search({ location: cityName });
    expect(await search({ location: cityName, keyword: '   ' })).toEqual(none);
    const res = await request(app).get('/api/hotels').query({ checkIn: day(1), checkOut: day(2), keyword: 'x'.repeat(101) });
    expect(res.status).toBe(400);
  });
});
