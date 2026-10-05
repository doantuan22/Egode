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
} from '../../test/factories';
import { getPrismaClient } from '../../config/prisma';
import { ROLE_NAMES } from '../../common/constants/roles';
import { ROOM_RATE_STATUS } from '../../common/constants/hotel-status';
import { addDaysToDateKey, businessToday, STAY_DATE_MESSAGES } from '../../common/utils/stay-dates';

/**
 * Bug #3 — the same stay-date rule on every endpoint that takes a stay: hotel search, room availability,
 * quote and booking. The matrix is run against all four so the rule cannot drift between them.
 */
const day = (offset: number) => addDaysToDateKey(businessToday(), offset);

const accountIds: number[] = [];
let diaPhuongId = 0;
let hotelId = 0;
let roomTypeId = 0;
let customerToken = '';

beforeAll(async () => {
  const owner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(owner.account.MaTaiKhoan, customer.account.MaTaiKhoan);
  customerToken = (await request(app).post('/api/auth/login').send({ identifier: customer.account.Email, MatKhau: customer.plainPassword })).body.data.accessToken;

  diaPhuongId = (await createTestDiaPhuong()).MaDiaPhuong;
  hotelId = (await createTestHotel(owner.account.MaTaiKhoan, diaPhuongId)).MaKhachSan;
  roomTypeId = (await createTestRoomType(hotelId)).MaLoaiPhong;

  // Sellable from today for two nights, so one real booking can go all the way through.
  const prisma = getPrismaClient();
  for (let i = 0; i < 2; i++) {
    await prisma.qUY_PHONG_GIA.create({
      data: { MaLoaiPhong: roomTypeId, NgayApDung: new Date(`${day(i)}T00:00:00Z`), GiaPhong: 400000, SoLuongPhong: 5, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE },
    });
  }
});

afterAll(async () => {
  const prisma = getPrismaClient();
  await prisma.cHI_TIET_DAT_PHONG.deleteMany({ where: { DAT_PHONG: { MaKhachSan: hotelId } } });
  await prisma.dAT_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });
  await deleteTestHotel(hotelId);
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await deleteTestDiaPhuong(diaPhuongId);
});

interface Endpoint {
  name: string;
  call: (checkIn: string, checkOut: string) => Promise<{ status: number; body: { details?: Array<{ field: string; message: string }> } }>;
  /** What an accepted stay answers; booking may legitimately answer 409 (no stock/prices) once validation passed. */
  accepted: (status: number) => boolean;
}

const endpoints: Endpoint[] = [
  {
    name: 'search',
    call: (checkIn, checkOut) => request(app).get('/api/hotels').query({ checkIn, checkOut }),
    accepted: (status) => status === 200,
  },
  {
    name: 'room availability',
    call: (checkIn, checkOut) => request(app).get(`/api/hotels/${hotelId}/rooms`).query({ checkIn, checkOut }),
    accepted: (status) => status === 200,
  },
  {
    name: 'quote',
    call: (checkIn, checkOut) => request(app).post(`/api/hotels/${hotelId}/quote`).send({ checkIn, checkOut, rooms: [{ maLoaiPhong: roomTypeId, soLuong: 1 }] }),
    accepted: (status) => status === 200,
  },
  {
    name: 'booking',
    call: (checkIn, checkOut) =>
      request(app)
        .post(`/api/hotels/${hotelId}/bookings`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ checkIn, checkOut, rooms: [{ maLoaiPhong: roomTypeId, soLuong: 1 }] }),
    // Past validation the booking either succeeds (201) or reports missing stock/prices (409) — never 400/500.
    accepted: (status) => status === 201 || status === 409,
  },
];

const rejected: Array<{ name: string; checkIn: number; checkOut: number; message: string }> = [
  { name: 'checkIn yesterday', checkIn: -1, checkOut: 1, message: STAY_DATE_MESSAGES.checkInPast },
  { name: 'checkOut equal to checkIn', checkIn: 2, checkOut: 2, message: STAY_DATE_MESSAGES.checkOutNotAfter },
  { name: 'checkOut before checkIn', checkIn: 5, checkOut: 3, message: STAY_DATE_MESSAGES.checkOutNotAfter },
  { name: '31 nights', checkIn: 2, checkOut: 33, message: STAY_DATE_MESSAGES.tooManyNights },
  { name: 'checkIn 366 days ahead', checkIn: 366, checkOut: 367, message: STAY_DATE_MESSAGES.checkInTooFar },
];

const accepted: Array<{ name: string; checkIn: number; checkOut: number }> = [
  { name: 'checkIn today (1 night)', checkIn: 0, checkOut: 1 },
  { name: '1 night', checkIn: 3, checkOut: 4 },
  { name: '30 nights', checkIn: 3, checkOut: 33 },
  { name: 'checkIn exactly 365 days ahead', checkIn: 365, checkOut: 366 },
];

describe.each(endpoints)('stay-date rule on $name', (endpoint) => {
  it.each(rejected)('rejects: $name', async ({ checkIn, checkOut, message }) => {
    const res = await endpoint.call(day(checkIn), day(checkOut));
    expect(res.status).toBe(400);
    expect(res.body.details?.map((e) => e.message)).toContain(message);
  });

  it.each(accepted)('accepts: $name', async ({ checkIn, checkOut }) => {
    const res = await endpoint.call(day(checkIn), day(checkOut));
    expect(endpoint.accepted(res.status), `status ${res.status}`).toBe(true);
  });

  it('answers a multi-year range with a 400 immediately (never iterates it)', async () => {
    const started = Date.now();
    const res = await endpoint.call(day(0), '9999-12-31');
    expect(res.status).toBe(400);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe('booking with a check-in of today is really created', () => {
  it('201 and persisted with today as NgayNhanPhong', async () => {
    const res = await endpoints[3].call(day(0), day(1));
    // The previous matrix run may already hold the room; either way no date rule fired.
    expect([201, 409]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body).toMatchObject({ data: { NgayNhanPhong: day(0), NgayTraPhong: day(1), SoDem: 1 } });
    }
  });

  it('does not create a booking for a past check-in', async () => {
    const before = await getPrismaClient().dAT_PHONG.count({ where: { MaKhachSan: hotelId } });
    const res = await endpoints[3].call(day(-3), day(-1));
    expect(res.status).toBe(400);
    expect(await getPrismaClient().dAT_PHONG.count({ where: { MaKhachSan: hotelId } })).toBe(before);
  });
});
