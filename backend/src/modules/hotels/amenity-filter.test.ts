import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  createTestAccount,
  createTestAmenity,
  createTestDiaPhuong,
  createTestHotel,
  createTestRoomType,
  deleteTestAccount,
  deleteTestAmenity,
  deleteTestDiaPhuong,
  deleteTestHotel,
} from '../../test/factories';
import { getPrismaClient } from '../../config/prisma';
import { ROLE_NAMES } from '../../common/constants/roles';
import { HOTEL_STATUS, ROOM_TYPE_STATUS } from '../../common/constants/hotel-status';
import { addDaysToDateKey, businessToday } from '../../common/utils/stay-dates';

/**
 * `amenities=1,2` keeps hotels that offer EVERY listed amenity, either on the hotel itself (KHACH_SAN_TIEN_NGHI) or on one of
 * its sellable room types (LOAI_PHONG_TIEN_NGHI) — Ban công, Bồn tắm, Minibar... exist only on rooms, so a hotel-only match
 * made them return nothing.
 */
const day = (n: number) => addDaysToDateKey(businessToday(), n);
const prisma = () => getPrismaClient();

let ownerId = 0;
let diaPhuongId = 0;
let cityName = '';
let amenityA = 0; // attached to hotels
let amenityB = 0; // attached to hotels
let amenityR = 0; // attached to room types
const hotels: Record<string, number> = {};
const nameToKey = new Map<number, string>();

const withRate = async (maLoaiPhong: number) =>
  prisma().qUY_PHONG_GIA.create({
    data: { MaLoaiPhong: maLoaiPhong, NgayApDung: new Date(`${day(1)}T00:00:00Z`), GiaPhong: 100000, SoLuongPhong: 2, TrangThai: 'Mở bán' },
  });

const addHotel = async (key: string, opts: { hotelAmenities?: number[]; rooms?: Array<{ amenities?: number[]; status?: string }>; status?: string } = {}) => {
  const hotel = await createTestHotel(ownerId, diaPhuongId, { status: opts.status });
  hotels[key] = hotel.MaKhachSan;
  nameToKey.set(hotel.MaKhachSan, key);
  for (const maTienNghi of opts.hotelAmenities ?? []) {
    await prisma().kHACH_SAN_TIEN_NGHI.create({ data: { MaKhachSan: hotel.MaKhachSan, MaTienNghi: maTienNghi } });
  }
  // Every hotel gets at least one sellable room so it is a search candidate; `rooms` adds amenity-bearing ones.
  const rooms = opts.rooms ?? [{}];
  for (const room of rooms) {
    const roomType = await createTestRoomType(hotel.MaKhachSan);
    if (room.status) await prisma().lOAI_PHONG.update({ where: { MaLoaiPhong: roomType.MaLoaiPhong }, data: { TrangThai: room.status } });
    for (const maTienNghi of room.amenities ?? []) {
      await prisma().lOAI_PHONG_TIEN_NGHI.create({ data: { MaLoaiPhong: roomType.MaLoaiPhong, MaTienNghi: maTienNghi } });
    }
    await withRate(roomType.MaLoaiPhong);
  }
};

beforeAll(async () => {
  ownerId = (await createTestAccount({ role: ROLE_NAMES.PARTNER })).account.MaTaiKhoan;
  const dp = await createTestDiaPhuong();
  diaPhuongId = dp.MaDiaPhuong;
  cityName = dp.TenThanhPho;
  amenityA = (await createTestAmenity()).MaTienNghi;
  amenityB = (await createTestAmenity()).MaTienNghi;
  amenityR = (await createTestAmenity()).MaTienNghi;

  await addHotel('hotelA_roomR', { hotelAmenities: [amenityA], rooms: [{ amenities: [amenityR] }] });
  await addHotel('hotelA', { hotelAmenities: [amenityA] });
  // Two room types both carrying R: the hotel must still be listed once.
  await addHotel('roomR_twice', { rooms: [{ amenities: [amenityR] }, { amenities: [amenityR] }] });
  // R only on a room type that is no longer sold (+ one plain active room): R must NOT count.
  await addHotel('roomR_discontinued', { rooms: [{ amenities: [amenityR], status: ROOM_TYPE_STATUS.DISCONTINUED }, {}] });
  await addHotel('plain');
  await addHotel('hotelB_roomR', { hotelAmenities: [amenityB], rooms: [{ amenities: [amenityR] }] });
  // A hotel that is not live never appears, whatever it offers.
  await addHotel('suspended_hotelA_roomR', { hotelAmenities: [amenityA], rooms: [{ amenities: [amenityR] }], status: HOTEL_STATUS.SUSPENDED });
});

afterAll(async () => {
  for (const id of Object.values(hotels)) await deleteTestHotel(id);
  for (const id of [amenityA, amenityB, amenityR]) await deleteTestAmenity(id);
  await deleteTestAccount(ownerId);
  await deleteTestDiaPhuong(diaPhuongId);
});

const search = async (query: Record<string, string | number> = {}) => {
  const res = await request(app).get('/api/hotels').query({ location: cityName, checkIn: day(1), checkOut: day(2), guests: 1, ...query });
  expect(res.status).toBe(200);
  const items = res.body.data as Array<{ MaKhachSan: number }>;
  return { keys: items.map((h) => nameToKey.get(h.MaKhachSan) as string).sort(), total: res.body.pagination.total as number };
};

describe('GET /api/hotels?amenities=… (hotel-level and room-level amenities)', () => {
  it('no amenity filter lists every live hotel', async () => {
    expect((await search()).keys).toEqual(['hotelA', 'hotelA_roomR', 'hotelB_roomR', 'plain', 'roomR_discontinued', 'roomR_twice']);
  });

  it('a hotel-level amenity matches hotels that list it', async () => {
    expect((await search({ amenities: amenityA })).keys).toEqual(['hotelA', 'hotelA_roomR']);
  });

  it('a room-only amenity matches hotels through their sellable room types', async () => {
    expect((await search({ amenities: amenityR })).keys).toEqual(['hotelA_roomR', 'hotelB_roomR', 'roomR_twice']);
  });

  it('a hotel with several room types carrying the amenity is listed once (and counted once)', async () => {
    const { keys, total } = await search({ amenities: amenityR });
    expect(keys.filter((k) => k === 'roomR_twice')).toHaveLength(1);
    expect(total).toBe(keys.length);
  });

  it('an amenity only on a discontinued room type does not count', async () => {
    expect((await search({ amenities: amenityR })).keys).not.toContain('roomR_discontinued');
  });

  it('several amenities are AND-ed, each satisfied by the hotel OR a room (mixed levels)', async () => {
    expect((await search({ amenities: `${amenityA},${amenityR}` })).keys).toEqual(['hotelA_roomR']);
    expect((await search({ amenities: `${amenityB},${amenityR}` })).keys).toEqual(['hotelB_roomR']);
    expect((await search({ amenities: `${amenityR},${amenityA}` })).keys).toEqual(['hotelA_roomR']); // order is irrelevant
  });

  it('amenities no single hotel combines return an empty page, not an error', async () => {
    const res = await request(app).get('/api/hotels').query({ location: cityName, checkIn: day(1), checkOut: day(2), amenities: `${amenityA},${amenityB}` });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination).toMatchObject({ total: 0, page: 1, totalPages: 1 });
  });

  it('an amenity id that does not exist returns nothing; combined with a real one it still returns nothing', async () => {
    expect((await search({ amenities: 999999999 })).keys).toEqual([]);
    expect((await search({ amenities: `${amenityR},999999999` })).keys).toEqual([]);
  });

  it('a repeated id behaves like a single one', async () => {
    expect((await search({ amenities: `${amenityR},${amenityR}` })).keys).toEqual((await search({ amenities: amenityR })).keys);
  });

  it('malformed ids (abc, 0, negatives, decimals, blanks) are ignored; if nothing valid is left there is no amenity filter', async () => {
    const all = (await search()).keys;
    expect((await search({ amenities: 'abc' })).keys).toEqual(all);
    expect((await search({ amenities: '0,-1,1.5' })).keys).toEqual(all);
    expect((await search({ amenities: ' , ,' })).keys).toEqual(all);
    expect((await search({ amenities: '' })).keys).toEqual(all);
    expect((await search({ amenities: `abc,${amenityR}` })).keys).toEqual(['hotelA_roomR', 'hotelB_roomR', 'roomR_twice']);
    expect((await search({ amenities: ` ${amenityR} , ${amenityA} ` })).keys).toEqual(['hotelA_roomR']);
  });

  it('never lists a hotel that is not live, even if it offers every amenity', async () => {
    expect((await search({ amenities: `${amenityA},${amenityR}` })).keys).not.toContain('suspended_hotelA_roomR');
  });

  it('combines with the other filters instead of replacing them', async () => {
    expect((await search({ amenities: amenityR, minPrice: 99999999 })).keys).toEqual([]);
    expect((await search({ amenities: amenityR, maxPrice: 100000 })).keys).toEqual(['hotelA_roomR', 'hotelB_roomR', 'roomR_twice']);
    expect((await search({ amenities: amenityR, starRating: 4 })).keys).toEqual([]); // test hotels are 3 stars
    expect((await search({ amenities: amenityR, starRating: 3 })).keys).toEqual(['hotelA_roomR', 'hotelB_roomR', 'roomR_twice']);
    expect((await search({ amenities: amenityR, keyword: 'zzz-no-such-hotel' })).keys).toEqual([]);
    expect((await search({ amenities: amenityR, location: 'zzz-no-such-city' })).keys).toEqual([]);
  });

  it('pagination counts the filtered set', async () => {
    const first = await request(app).get('/api/hotels').query({ location: cityName, checkIn: day(1), checkOut: day(2), amenities: amenityR, limit: 2, page: 1 });
    const second = await request(app).get('/api/hotels').query({ location: cityName, checkIn: day(1), checkOut: day(2), amenities: amenityR, limit: 2, page: 2 });
    expect(first.body.data).toHaveLength(2);
    expect(second.body.data).toHaveLength(1);
    expect(first.body.pagination).toMatchObject({ total: 3, totalPages: 2 });
    const ids = [...first.body.data, ...second.body.data].map((h: { MaKhachSan: number }) => h.MaKhachSan);
    expect(new Set(ids).size).toBe(3);
  });
});
