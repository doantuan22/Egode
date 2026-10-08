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

/**
 * What a SECOND guest sees for dates that overlap an existing booking: the rooms list, the quote, the booking itself
 * and the hotel search. Real SQL Server, through the HTTP API. A stay is the half-open interval [checkIn, checkOut):
 * the night of the checkout date is free, so a guest may arrive the day another leaves.
 */

const day = (n: number) => addDaysToDateKey(businessToday(), n);
const at = (n: number) => new Date(`${day(n)}T00:00:00Z`);
const prisma = () => getPrismaClient();

const accountIds: number[] = [];
const hotelIds: number[] = [];
let diaPhuongId = 0;
let cityName = '';
let policyId = 0;
let ownerId = 0;
let hotelId = 0;
let otherHotelId = 0;
let guestAId = 0;
let guestAToken = '';
let guestBToken = '';

const login = async (email: string, password: string) =>
  (await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password })).body.data.accessToken as string;

/** A room type with a price and `stock` rooms on each of days 0..29. */
const newRoom = async (hotel: number, stock: number, price = 500_000) => {
  const room = (await createTestRoomType(hotel)).MaLoaiPhong;
  await prisma().qUY_PHONG_GIA.createMany({
    data: Array.from({ length: 30 }, (_, i) => ({ MaLoaiPhong: room, NgayApDung: at(i), GiaPhong: price, SoLuongPhong: stock, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE })),
  });
  return room;
};

/** Someone else's booking, written straight to the database so every status and age can be set exactly. */
const occupy = async (room: number, from: number, to: number, qty = 1, status: string = BOOKING_STATUS.CONFIRMED, hotel = hotelId, createdMinutesAgo = 0) => {
  const booking = await createTestBookingDirect(guestAId, hotel, policyId, at(from), at(to), {
    trangThai: status,
    ngayTao: new Date(Date.now() - createdMinutesAgo * 60_000),
  });
  await prisma().cHI_TIET_DAT_PHONG.create({ data: { MaDatPhong: booking.MaDatPhong, MaLoaiPhong: room, SoLuongPhong: qty } });
  return booking;
};

const rooms = async (from: number, to: number, hotel = hotelId) =>
  (await request(app).get(`/api/hotels/${hotel}/rooms`).query({ checkIn: day(from), checkOut: day(to) })).body.data as Array<{
    MaLoaiPhong: number;
    SoPhongConLai: number;
    ConHang: boolean;
    GiaTheoDem: number | null;
  }>;
const roomFor = async (room: number, from: number, to: number, hotel = hotelId) => (await rooms(from, to, hotel)).find((r) => r.MaLoaiPhong === room)!;
const quote = (room: number, from: number, to: number, qty = 1) =>
  request(app).post(`/api/hotels/${hotelId}/quote`).send({ checkIn: day(from), checkOut: day(to), rooms: [{ maLoaiPhong: room, soLuong: qty }] });
const book = (room: number, from: number, to: number, qty = 1, token = guestBToken) =>
  request(app).post(`/api/hotels/${hotelId}/bookings`).set('Authorization', `Bearer ${token}`).send({ checkIn: day(from), checkOut: day(to), rooms: [{ maLoaiPhong: room, soLuong: qty }] });
const search = async (from: number, to: number, guests = 1) =>
  (await request(app).get('/api/hotels').query({ location: cityName, checkIn: day(from), checkOut: day(to), guests })).body.data as Array<{
    MaKhachSan: number;
    ConPhong: boolean;
    GiaTuDauTu: number | null;
  }>;

beforeAll(async () => {
  const [owner, guestA, guestB] = await Promise.all([
    createTestAccount({ role: ROLE_NAMES.PARTNER }),
    createTestAccount({ role: ROLE_NAMES.CUSTOMER }),
    createTestAccount({ role: ROLE_NAMES.CUSTOMER }),
  ]);
  accountIds.push(owner.account.MaTaiKhoan, guestA.account.MaTaiKhoan, guestB.account.MaTaiKhoan);
  ownerId = owner.account.MaTaiKhoan;
  guestAId = guestA.account.MaTaiKhoan;
  guestAToken = await login(guestA.account.Email, guestA.plainPassword);
  guestBToken = await login(guestB.account.Email, guestB.plainPassword);

  const diaPhuong = await createTestDiaPhuong();
  diaPhuongId = diaPhuong.MaDiaPhuong;
  cityName = diaPhuong.TenThanhPho;
  hotelId = (await createTestHotel(ownerId, diaPhuongId)).MaKhachSan;
  otherHotelId = (await createTestHotel(ownerId, diaPhuongId)).MaKhachSan;
  hotelIds.push(hotelId, otherHotelId);
  policyId = (await createTestCancellationPolicy([{ soGioTruocNhanPhong: 24, tyLeHoanTien: 100 }])).MaChinhSachHuy;
});

afterAll(async () => {
  const roomIds = (await prisma().lOAI_PHONG.findMany({ where: { MaKhachSan: { in: hotelIds } }, select: { MaLoaiPhong: true } })).map((r) => r.MaLoaiPhong);
  const bookingIds = (await prisma().dAT_PHONG.findMany({ where: { MaKhachSan: { in: hotelIds } }, select: { MaDatPhong: true } })).map((b) => b.MaDatPhong);
  await prisma().cHI_TIET_DAT_PHONG.deleteMany({ where: { MaLoaiPhong: { in: roomIds } } });
  await prisma().dAT_PHONG.deleteMany({ where: { MaDatPhong: { in: bookingIds } } });
  await Promise.all(hotelIds.map((id) => deleteTestHotel(id)));
  await deleteTestCancellationPolicy(policyId);
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await deleteTestDiaPhuong(diaPhuongId);
});

describe('a booked room is still LISTED, but marked sold out for the overlapping dates', () => {
  it('stays in the rooms list with ConHang=false and 0 rooms left (it is not hidden)', async () => {
    const room = await newRoom(hotelId, 1);
    await occupy(room, 5, 7);

    const list = await rooms(5, 7);
    const entry = list.find((r) => r.MaLoaiPhong === room);
    expect(entry).toBeDefined();
    expect(entry).toMatchObject({ ConHang: false, SoPhongConLai: 0 });
    expect(entry!.GiaTheoDem).toBe(500_000); // still priced: the guest sees what it would cost, and that it is gone
  });
});

describe('every way a second stay can overlap the first one (booking = nights 5 and 6, check-out day 7; 1 room in stock)', () => {
  let room = 0;
  beforeAll(async () => {
    room = await newRoom(hotelId, 1);
    await occupy(room, 5, 7);
  });

  it.each([
    ['exactly the same dates', 5, 7],
    ['overlaps the start (arrive before, leave inside)', 4, 6],
    ['overlaps the end (arrive inside, leave after)', 6, 8],
    ['sits inside the booked nights (one night)', 5, 6],
    ['the second booked night only', 6, 7],
    ['wraps around the whole booking', 3, 10],
  ])('SOLD OUT: %s [%i,%i)', async (_name, from, to) => {
    expect(await roomFor(room, from, to)).toMatchObject({ ConHang: false, SoPhongConLai: 0 });
    expect((await quote(room, from, to)).body.data).toMatchObject({ KhaDung: false });
    expect((await book(room, from, to)).status).toBe(409);
  });

  it.each([
    ['leaves the day the other guest arrives (check-out day 5 = their check-in day)', 3, 5],
    ['arrives the day the other guest leaves (check-in day 7 = their check-out day)', 7, 9],
    ['entirely before', 1, 3],
    ['entirely after', 9, 12],
  ])('AVAILABLE: %s [%i,%i)', async (_name, from, to) => {
    expect(await roomFor(room, from, to)).toMatchObject({ ConHang: true, SoPhongConLai: 1 });
    expect((await quote(room, from, to)).body.data).toMatchObject({ KhaDung: true });
  });
});

describe('only the booked room type, on the booked hotel, is affected', () => {
  it('a sibling room type of the same hotel stays available', async () => {
    const booked = await newRoom(hotelId, 1);
    const sibling = await newRoom(hotelId, 1);
    await occupy(booked, 5, 7);

    expect((await roomFor(booked, 5, 7)).ConHang).toBe(false);
    expect(await roomFor(sibling, 5, 7)).toMatchObject({ ConHang: true, SoPhongConLai: 1 });
  });

  it('another hotel is untouched', async () => {
    const booked = await newRoom(hotelId, 1);
    const elsewhere = await newRoom(otherHotelId, 1);
    await occupy(booked, 5, 7);

    expect(await roomFor(elsewhere, 5, 7, otherHotelId)).toMatchObject({ ConHang: true, SoPhongConLai: 1 });
  });
});

describe('which booking statuses hold a room', () => {
  it.each([
    [BOOKING_STATUS.CONFIRMED, false],
    [BOOKING_STATUS.COMPLETED, false],
    [BOOKING_STATUS.CANCELLED, true],
  ])('"%s" → room available for the others: %s', async (status, available) => {
    const room = await newRoom(hotelId, 1);
    await occupy(room, 5, 7, 1, status);

    expect((await roomFor(room, 5, 7)).ConHang).toBe(available);
    expect((await book(room, 5, 7)).status).toBe(available ? 201 : 409);
  });

  it('an unpaid booking inside the payment window holds the room', async () => {
    const room = await newRoom(hotelId, 1);
    await occupy(room, 5, 7, 1, BOOKING_STATUS.PENDING_PAYMENT, hotelId, 2);

    expect((await roomFor(room, 5, 7)).ConHang).toBe(false);
    expect((await book(room, 5, 7)).status).toBe(409);
  });

  it('an unpaid booking past the payment window releases it, and the other guest can book it', async () => {
    const room = await newRoom(hotelId, 1);
    const stale = await occupy(room, 5, 7, 1, BOOKING_STATUS.PENDING_PAYMENT, hotelId, 24 * 60);

    expect((await roomFor(room, 5, 7)).ConHang).toBe(true);
    expect((await book(room, 5, 7)).status).toBe(201);
    expect((await prisma().dAT_PHONG.findUniqueOrThrow({ where: { MaDatPhong: stale.MaDatPhong } })).TrangThai).toBe(BOOKING_STATUS.CANCELLED);
  });
});

describe('several rooms of one type: the count left, and the night with the least stock decides', () => {
  it('3 in stock, 2 taken: 1 left, so 1 can be quoted/booked and 2 cannot', async () => {
    const room = await newRoom(hotelId, 3);
    await occupy(room, 5, 7, 2);

    expect(await roomFor(room, 5, 7)).toMatchObject({ ConHang: true, SoPhongConLai: 1 });
    expect((await quote(room, 5, 7, 1)).body.data).toMatchObject({ KhaDung: true });
    const tooMany = (await quote(room, 5, 7, 2)).body.data;
    expect(tooMany.KhaDung).toBe(false);
    expect(tooMany.ChiTietPhong[0]).toMatchObject({ SoPhongConLai: 1, DuPhong: false });
    expect((await book(room, 5, 7, 2)).status).toBe(409);
    expect((await book(room, 5, 7, 1)).status).toBe(201);
    expect(await roomFor(room, 5, 7)).toMatchObject({ ConHang: false, SoPhongConLai: 0 }); // that was the last one
  });

  it('one booking line of 2 rooms plus another booking of 1 room add up per night', async () => {
    const room = await newRoom(hotelId, 3);
    await occupy(room, 5, 7, 2);
    await occupy(room, 6, 8, 1);

    expect((await roomFor(room, 5, 6)).SoPhongConLai).toBe(1); // night 5: 2 taken
    expect((await roomFor(room, 6, 7)).SoPhongConLai).toBe(0); // night 6: 2 + 1 taken
    expect((await roomFor(room, 7, 8)).SoPhongConLai).toBe(2); // night 7: 1 taken
  });

  it('a multi-night stay can only have as many rooms as its busiest night leaves (stock 2: one night fully taken)', async () => {
    const room = await newRoom(hotelId, 2);
    await occupy(room, 6, 7, 2); // night 6 only, both rooms

    expect(await roomFor(room, 5, 8)).toMatchObject({ ConHang: false, SoPhongConLai: 0 });
    expect((await book(room, 5, 8)).status).toBe(409);
    expect(await roomFor(room, 7, 9)).toMatchObject({ ConHang: true, SoPhongConLai: 2 }); // avoiding that night is fine
  });

  it('two partially overlapping bookings: each night is counted separately', async () => {
    const room = await newRoom(hotelId, 2);
    await occupy(room, 5, 7, 1);
    await occupy(room, 6, 8, 1);

    expect((await roomFor(room, 5, 6)).SoPhongConLai).toBe(1);
    expect((await roomFor(room, 6, 7)).SoPhongConLai).toBe(0);
    expect((await roomFor(room, 7, 8)).SoPhongConLai).toBe(1);
    expect((await roomFor(room, 5, 8)).SoPhongConLai).toBe(0);
  });
});

describe('a second customer through the real booking API', () => {
  it('after A books the last room, B sees it sold out, cannot quote or book it, but can take other dates', async () => {
    const room = await newRoom(hotelId, 1);

    const a = await book(room, 10, 12, 1, guestAToken);
    expect(a.status).toBe(201);

    expect(await roomFor(room, 10, 12)).toMatchObject({ ConHang: false, SoPhongConLai: 0 });
    expect((await quote(room, 11, 13)).body.data.KhaDung).toBe(false);
    expect((await book(room, 11, 13)).status).toBe(409);
    expect((await book(room, 12, 14)).status).toBe(201); // starts on A's check-out day
  });

  it('when A cancels, the room comes back for B at once', async () => {
    const room = await newRoom(hotelId, 1);
    const a = await book(room, 10, 12, 1, guestAToken);
    expect((await roomFor(room, 10, 12)).ConHang).toBe(false);

    const cancelled = await request(app).post(`/api/bookings/${a.body.data.MaDatPhong}/cancel`).set('Authorization', `Bearer ${guestAToken}`).send({});
    expect(cancelled.status).toBe(200);

    expect((await roomFor(room, 10, 12)).ConHang).toBe(true);
    expect((await book(room, 10, 12)).status).toBe(201);
  });
});

describe('hotel search for the overlapping dates', () => {
  it('lists a hotel whose only room is taken, flagged "hết phòng" and with no price', async () => {
    const hotel = (await createTestHotel(ownerId, diaPhuongId)).MaKhachSan;
    hotelIds.push(hotel);
    const room = await newRoom(hotel, 1);
    await occupy(room, 5, 7, 1, BOOKING_STATUS.CONFIRMED, hotel);

    const item = (await search(5, 7)).find((h) => h.MaKhachSan === hotel);
    expect(item).toBeDefined();
    expect(item).toMatchObject({ ConPhong: false, GiaTuDauTu: null });
    expect((await search(7, 9)).find((h) => h.MaKhachSan === hotel)).toMatchObject({ ConPhong: true, GiaTuDauTu: 500_000 }); // free again from the check-out day
  });

  it('with one room taken and another free, "from" price is the cheapest room that is still FREE', async () => {
    const hotel = (await createTestHotel(ownerId, diaPhuongId)).MaKhachSan;
    hotelIds.push(hotel);
    const cheapButTaken = await newRoom(hotel, 1, 300_000);
    await newRoom(hotel, 1, 900_000);
    await occupy(cheapButTaken, 5, 7, 1, BOOKING_STATUS.CONFIRMED, hotel);

    expect((await search(5, 7)).find((h) => h.MaKhachSan === hotel)).toMatchObject({ ConPhong: true, GiaTuDauTu: 900_000 });
    expect((await search(8, 9)).find((h) => h.MaKhachSan === hotel)).toMatchObject({ ConPhong: true, GiaTuDauTu: 300_000 });
  });

  it('counts the party against the rooms still free: listed as sold out when too few remain, not listed when it could never fit', async () => {
    const hotel = (await createTestHotel(ownerId, diaPhuongId)).MaKhachSan;
    hotelIds.push(hotel);
    const room = await newRoom(hotel, 2); // 2 rooms x 2 guests = 4 in stock
    await occupy(room, 5, 7, 1, BOOKING_STATUS.CONFIRMED, hotel); // 1 room x 2 guests still free

    const find = async (guests: number) => (await search(5, 7, guests)).find((h) => h.MaKhachSan === hotel);
    expect(await find(2)).toMatchObject({ ConPhong: true });
    expect(await find(3)).toMatchObject({ ConPhong: false }); // fits the hotel in principle, not the rooms left
    expect(await find(5)).toBeUndefined(); // could never fit, free or not
  });
});
