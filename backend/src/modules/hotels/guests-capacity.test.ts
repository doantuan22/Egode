import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  createTestAccount,
  deleteTestAccount,
  createTestDiaPhuong,
  deleteTestDiaPhuong,
  createTestHotel,
  deleteTestHotel,
  createTestRoomType,
  createTestCancellationPolicy,
  deleteTestCancellationPolicy,
  createTestBookingDirect,
} from '../../test/factories';
import { getPrismaClient } from '../../config/prisma';
import { ROLE_NAMES } from '../../common/constants/roles';
import { BOOKING_STATUS, ROOM_RATE_STATUS } from '../../common/constants/hotel-status';
import { addDaysToDateKey, businessToday } from '../../common/utils/stay-dates';
import { assertCapacity, totalCapacity } from './capacity';

/**
 * Bug #18 — the party size is a runtime input of search → rooms → quote → booking (DAT_PHONG stores nothing about it).
 * The server alone decides:  Σ (SucChua × rooms)  >=  guests.   Quote and booking reject otherwise; search only
 * offers hotels whose rooms together could hold the party.
 */
const day = (n: number) => addDaysToDateKey(businessToday(), n);
const at = (n: number) => new Date(`${day(n)}T00:00:00Z`);
const prisma = () => getPrismaClient();

const accountIds: number[] = [];
let diaPhuongId = 0;
let cityName = '';
let hotelId = 0;
let policyId = 0;
let customerId = 0;
let customerToken = '';

beforeAll(async () => {
  const owner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(owner.account.MaTaiKhoan, customer.account.MaTaiKhoan);
  customerId = customer.account.MaTaiKhoan;
  customerToken = (await request(app).post('/api/auth/login').send({ identifier: customer.account.Email, MatKhau: customer.plainPassword })).body.data.accessToken;
  const dp = await createTestDiaPhuong();
  diaPhuongId = dp.MaDiaPhuong;
  cityName = dp.TenThanhPho;
  hotelId = (await createTestHotel(owner.account.MaTaiKhoan, diaPhuongId)).MaKhachSan;
  policyId = (await createTestCancellationPolicy([{ soGioTruocNhanPhong: 24, tyLeHoanTien: 100 }])).MaChinhSachHuy;
});

afterAll(async () => {
  await prisma().cHI_TIET_DAT_PHONG.deleteMany({ where: { DAT_PHONG: { MaKhachSan: hotelId } } });
  await prisma().dAT_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });
  await deleteTestCancellationPolicy(policyId);
  await deleteTestHotel(hotelId);
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await deleteTestDiaPhuong(diaPhuongId);
});

/** A room type holding `sucChua` guests, `stock` rooms on sale for the nights day+1 and day+2. */
const roomType = async (sucChua: number, stock: number) => {
  const created = await createTestRoomType(hotelId);
  await prisma().lOAI_PHONG.update({ where: { MaLoaiPhong: created.MaLoaiPhong }, data: { SucChua: sucChua } });
  for (const n of [1, 2]) {
    await prisma().qUY_PHONG_GIA.create({ data: { MaLoaiPhong: created.MaLoaiPhong, NgayApDung: at(n), GiaPhong: 400000, SoLuongPhong: stock, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE } });
  }
  return created.MaLoaiPhong;
};
const clearHotel = async () => {
  await prisma().cHI_TIET_DAT_PHONG.deleteMany({ where: { DAT_PHONG: { MaKhachSan: hotelId } } });
  await prisma().dAT_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });
  await prisma().qUY_PHONG_GIA.deleteMany({ where: { LOAI_PHONG: { MaKhachSan: hotelId } } });
  await prisma().lOAI_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });
};
const occupy = async (roomTypeId: number, rooms: number) => {
  const booking = await createTestBookingDirect(customerId, hotelId, policyId, at(1), at(3), { trangThai: BOOKING_STATUS.CONFIRMED });
  await prisma().cHI_TIET_DAT_PHONG.create({ data: { MaDatPhong: booking.MaDatPhong, MaLoaiPhong: roomTypeId, SoLuongPhong: rooms } });
};

const stay = { checkIn: day(1), checkOut: day(3) };
const quote = (rooms: Array<{ maLoaiPhong: number; soLuong: number }>, guests?: number | string) =>
  request(app).post(`/api/hotels/${hotelId}/quote`).send({ ...stay, rooms, ...(guests === undefined ? {} : { guests }) });
const book = (rooms: Array<{ maLoaiPhong: number; soLuong: number }>, guests?: number | string) =>
  request(app).post(`/api/hotels/${hotelId}/bookings`).set('Authorization', `Bearer ${customerToken}`).send({ ...stay, rooms, ...(guests === undefined ? {} : { guests }) });
const bookingCount = () => prisma().dAT_PHONG.count({ where: { MaKhachSan: hotelId } });

describe('the capacity rule itself', () => {
  it('Σ (SucChua × rooms) >= guests', () => {
    expect(totalCapacity([{ sucChua: 2, soLuong: 2 }, { sucChua: 4, soLuong: 1 }])).toBe(8);
    expect(() => assertCapacity(8, [{ sucChua: 2, soLuong: 2 }, { sucChua: 4, soLuong: 1 }])).not.toThrow();
    expect(() => assertCapacity(9, [{ sucChua: 2, soLuong: 2 }, { sucChua: 4, soLuong: 1 }])).toThrowError(/chỉ chứa tối đa 8 khách, không đủ cho 9 khách/);
    expect(() => assertCapacity(1, [])).toThrow();
  });
});

describe('search offers hotels whose rooms TOGETHER could hold the party', () => {
  const find = async (guests: number) => {
    const res = await request(app).get('/api/hotels').query({ location: cityName, ...stay, guests });
    expect(res.status).toBe(200);
    return res.body.data.find((h: { MaKhachSan: number }) => h.MaKhachSan === hotelId) as { ConPhong: boolean; GiaTuDauTu: number | null } | undefined;
  };

  it('3 two-person rooms + 1 four-person room hold up to 10: listed up to 10 guests (rooms combined), not for 11', async () => {
    await clearHotel();
    await roomType(2, 3);
    await roomType(4, 1);
    for (const guests of [1, 2, 6, 10]) expect(await find(guests), `guests ${guests}`).toMatchObject({ ConPhong: true });
    expect(await find(11)).toBeUndefined(); // could never hold them, even with every room free
  });

  it('listed but "hết phòng" when its rooms could hold the party yet too few are free on these dates', async () => {
    await clearHotel();
    const standard = await roomType(2, 3);
    await roomType(4, 1);
    await occupy(standard, 2); // free now: 1 × 2 + 1 × 4 = 6 guests
    expect(await find(6)).toMatchObject({ ConPhong: true });
    const full = await find(7);
    expect(full).toMatchObject({ ConPhong: false, GiaTuDauTu: null });
  });

  it('a hotel with no stock at all for the stay is not offered', async () => {
    await clearHotel();
    await createTestRoomType(hotelId); // active room type, no calendar rows
    expect(await find(1)).toBeUndefined();
  });
});

describe('the rooms list never hides a room type because of the party size', () => {
  it('guests=10 still lists every active room type, each with SucChua', async () => {
    await clearHotel();
    await roomType(2, 3);
    await roomType(4, 1);
    const res = await request(app).get(`/api/hotels/${hotelId}/rooms`).query({ ...stay, guests: 10 });
    expect(res.status).toBe(200);
    expect(res.body.data.map((r: { SucChua: number }) => r.SucChua).sort()).toEqual([2, 4]);
  });

  it('guests out of range is a validation error', async () => {
    expect((await request(app).get(`/api/hotels/${hotelId}/rooms`).query({ ...stay, guests: 0 })).status).toBe(400);
    expect((await request(app).get(`/api/hotels/${hotelId}/rooms`).query({ ...stay, guests: 51 })).status).toBe(400);
  });
});

describe('quote validates the party against the chosen rooms', () => {
  it('too small is rejected: 400 CAPACITY_EXCEEDED, details point at guests', async () => {
    await clearHotel();
    const standard = await roomType(2, 3);
    const res = await quote([{ maLoaiPhong: standard, soLuong: 1 }], 4);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CAPACITY_EXCEEDED');
    expect(res.body.message).toMatch(/chỉ chứa tối đa 2 khách, không đủ cho 4 khách/);
    expect(res.body.details).toEqual([{ field: 'guests', message: res.body.message }]);
  });

  it('enough once more rooms are chosen (2 × 2 = 4), and the answer says what it was checked for', async () => {
    await clearHotel();
    const standard = await roomType(2, 3);
    const res = await quote([{ maLoaiPhong: standard, soLuong: 2 }], 4);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ KhaDung: true, SoKhach: 4, TongSucChua: 4 });
  });

  it('mixed room types add up (2 + 4 = 6 for 6 guests)', async () => {
    await clearHotel();
    const standard = await roomType(2, 3);
    const suite = await roomType(4, 1);
    expect((await quote([{ maLoaiPhong: standard, soLuong: 1 }, { maLoaiPhong: suite, soLuong: 1 }], 6)).status).toBe(200);
    expect((await quote([{ maLoaiPhong: standard, soLuong: 1 }, { maLoaiPhong: suite, soLuong: 1 }], 7)).status).toBe(400);
  });

  it('guests left out means one guest; 0, 51 and non-numbers are validation errors', async () => {
    await clearHotel();
    const standard = await roomType(2, 3);
    const rooms = [{ maLoaiPhong: standard, soLuong: 1 }];
    const omitted = await quote(rooms);
    expect(omitted.status).toBe(200);
    expect(omitted.body.data.SoKhach).toBe(1);
    for (const bad of [0, 51, -2, 'abc', 2.5]) {
      const res = await quote(rooms, bad);
      expect(res.status, `guests ${bad}`).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details[0].field).toBe('guests');
    }
  });
});

describe('booking validates once more, from the database, and never trusts the quote', () => {
  it('rooms too small → 400 CAPACITY_EXCEEDED and nothing is created', async () => {
    await clearHotel();
    const standard = await roomType(2, 3);
    const before = await bookingCount();

    const res = await book([{ maLoaiPhong: standard, soLuong: 1 }], 3);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CAPACITY_EXCEEDED');
    expect(await bookingCount()).toBe(before);
  });

  it('exactly enough is accepted (2 × 2 = 4 guests); so is leaving guests out', async () => {
    await clearHotel();
    const standard = await roomType(2, 3);
    expect((await book([{ maLoaiPhong: standard, soLuong: 2 }], 4)).status).toBe(201);
    expect((await book([{ maLoaiPhong: standard, soLuong: 1 }])).status).toBe(201);
  });

  it('a quote that passed for 2 guests does not let a booking for 9 through: the booking is judged on its own guests', async () => {
    await clearHotel();
    const standard = await roomType(2, 3);
    const rooms = [{ maLoaiPhong: standard, soLuong: 1 }];
    expect((await quote(rooms, 2)).status).toBe(200);

    expect((await book(rooms, 9)).status).toBe(400);
  });

  it('capacity that shrank after the quote is caught at booking time (the last word is the database)', async () => {
    await clearHotel();
    const suite = await roomType(4, 2);
    const rooms = [{ maLoaiPhong: suite, soLuong: 1 }];
    expect((await quote(rooms, 4)).status).toBe(200);

    await prisma().lOAI_PHONG.update({ where: { MaLoaiPhong: suite }, data: { SucChua: 2 } }); // the owner edits the room type

    const res = await book(rooms, 4);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CAPACITY_EXCEEDED');
    expect((await book(rooms, 2)).status).toBe(201);
  });

  it('the party size is not stored: DAT_PHONG has no guest column and the booking response carries none', async () => {
    await clearHotel();
    const standard = await roomType(2, 3);
    const res = await book([{ maLoaiPhong: standard, soLuong: 2 }], 4);
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toMatch(/SoKhach/);
    const columns = await prisma().$queryRaw<Array<{ COLUMN_NAME: string }>>`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'DAT_PHONG'`;
    expect(columns.map((c) => c.COLUMN_NAME.toLowerCase()).filter((c) => c.includes('khach') && c !== 'matkhoan')).not.toContain('sokhach');
  });
});
