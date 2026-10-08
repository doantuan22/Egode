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
import { addDaysToDateKey, businessToday } from '../../common/utils/stay-dates';

/**
 * The bill must be built from the price of each night the guest STAYS (QUY_PHONG_GIA.NgayApDung in
 * [checkIn, checkOut)), never from today's price, the price on the booking date, or the checkout night.
 * Real SQL Server, through the HTTP API. Every price below is distinct so a wrong date shows up in the total.
 */

const addDays = (days: number): Date => new Date(`${addDaysToDateKey(businessToday(), days)}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

const TODAY_PRICE = 111_000; // decoy: the price on the day the booking is made
const BEFORE_PRICE = 999_000; // decoy: the night before check-in
const CHECKOUT_PRICE = 777_000; // decoy: the checkout date itself is not a night

const accountIds: number[] = [];
const diaPhuongIds: number[] = [];
const hotelIds: number[] = [];
let hotelId: number;
let customerToken: string;

const loginAndGetToken = async (email: string, password: string) => {
  const res = await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password });
  return res.body.data.accessToken as string;
};

const prisma = () => getPrismaClient();

const newRoomType = async () => (await createTestRoomType(hotelId)).MaLoaiPhong;

const setRate = (maLoaiPhong: number, day: number, price: number, stock = 5, status: string = ROOM_RATE_STATUS.OPEN_FOR_SALE) =>
  prisma().qUY_PHONG_GIA.upsert({
    where: { MaLoaiPhong_NgayApDung: { MaLoaiPhong: maLoaiPhong, NgayApDung: addDays(day) } },
    create: { MaLoaiPhong: maLoaiPhong, NgayApDung: addDays(day), GiaPhong: price, SoLuongPhong: stock, TrangThai: status },
    update: { GiaPhong: price, SoLuongPhong: stock, TrangThai: status },
  });

const quote = (checkInDay: number, checkOutDay: number, rooms: Array<{ maLoaiPhong: number; soLuong: number }>) =>
  request(app).post(`/api/hotels/${hotelId}/quote`).send({ checkIn: iso(addDays(checkInDay)), checkOut: iso(addDays(checkOutDay)), rooms });

const book = (checkInDay: number, checkOutDay: number, rooms: Array<{ maLoaiPhong: number; soLuong: number }>) =>
  request(app)
    .post(`/api/hotels/${hotelId}/bookings`)
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ checkIn: iso(addDays(checkInDay)), checkOut: iso(addDays(checkOutDay)), rooms });

/** Stay = days 3,4,5 (checkout day 6). Day 0 = today, day 2 = the night before, day 6 = checkout night. */
const priceStayRoom = async (nightly: [number, number, number]) => {
  const room = await newRoomType();
  await setRate(room, 0, TODAY_PRICE);
  await setRate(room, 2, BEFORE_PRICE);
  await setRate(room, 3, nightly[0]);
  await setRate(room, 4, nightly[1]);
  await setRate(room, 5, nightly[2]);
  await setRate(room, 6, CHECKOUT_PRICE);
  return room;
};

beforeAll(async () => {
  const owner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  accountIds.push(owner.account.MaTaiKhoan);
  const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(customer.account.MaTaiKhoan);
  customerToken = await loginAndGetToken(customer.account.Email, customer.plainPassword);

  const diaPhuong = await createTestDiaPhuong();
  diaPhuongIds.push(diaPhuong.MaDiaPhuong);
  const hotel = await createTestHotel(owner.account.MaTaiKhoan, diaPhuong.MaDiaPhuong);
  hotelIds.push(hotel.MaKhachSan);
  hotelId = hotel.MaKhachSan;
});

afterAll(async () => {
  const db = prisma();
  const rooms = (await db.lOAI_PHONG.findMany({ where: { MaKhachSan: hotelId }, select: { MaLoaiPhong: true } })).map((r) => r.MaLoaiPhong);
  const bookings = await db.dAT_PHONG.findMany({ where: { MaKhachSan: hotelId }, select: { MaDatPhong: true } });
  await db.cHI_TIET_DAT_PHONG.deleteMany({ where: { MaLoaiPhong: { in: rooms } } });
  await db.dAT_PHONG.deleteMany({ where: { MaDatPhong: { in: bookings.map((b) => b.MaDatPhong) } } });
  await Promise.all(hotelIds.map((id) => deleteTestHotel(id)));
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await Promise.all(diaPhuongIds.map((id) => deleteTestDiaPhuong(id)));
});

describe('quote prices each stayed night with that date\'s own rate', () => {
  it('sums nights 3,4,5 and ignores today, the night before and the checkout night', async () => {
    const room = await priceStayRoom([1_000_000, 2_000_000, 3_000_000]);

    const res = await quote(3, 6, [{ maLoaiPhong: room, soLuong: 2 }]);

    expect(res.status).toBe(200);
    const line = res.body.data.ChiTietPhong[0];
    expect(res.body.data.SoDem).toBe(3);
    expect(line.ThanhTien).toBe(12_000_000); // (1M + 2M + 3M) x 2 rooms
    expect(line.GiaTheoDem).toBe(2_000_000); // display average only
    expect(res.body.data.TongTienThanhToan).toBe(12_000_000);
  });

  it('is not moved by today\'s price: a far-future stay uses its own date', async () => {
    const room = await newRoomType();
    await setRate(room, 0, TODAY_PRICE);
    await setRate(room, 40, 4_200_000);
    await setRate(room, 41, 4_400_000);

    const before = await quote(40, 41, [{ maLoaiPhong: room, soLuong: 1 }]);
    expect(before.status).toBe(200);
    expect(before.body.data.TongTienPhong).toBe(4_200_000);

    await setRate(room, 0, 1); // changing today's price must change nothing for a stay on day 40
    const after = await quote(40, 41, [{ maLoaiPhong: room, soLuong: 1 }]);
    expect(after.body.data.TongTienPhong).toBe(4_200_000);
  });

  it('picks up a change made to one night of the stay, and only that night', async () => {
    const room = await priceStayRoom([1_000_000, 2_000_000, 3_000_000]);
    await setRate(room, 4, 2_500_000);

    const res = await quote(3, 6, [{ maLoaiPhong: room, soLuong: 1 }]);
    expect(res.body.data.TongTienPhong).toBe(6_500_000);

    await setRate(room, 6, 50_000_000); // the checkout night is not billed
    await setRate(room, 2, 50_000_000); // neither is the night before check-in
    const unchanged = await quote(3, 6, [{ maLoaiPhong: room, soLuong: 1 }]);
    expect(unchanged.body.data.TongTienPhong).toBe(6_500_000);
  });
});

describe('creating a booking bills the stayed nights and stores the total', () => {
  it('writes the per-night sum into DAT_PHONG and keeps it when prices change afterwards', async () => {
    const room = await priceStayRoom([1_000_000, 2_000_000, 3_000_000]);

    const res = await book(3, 6, [{ maLoaiPhong: room, soLuong: 2 }]);
    expect(res.status).toBe(201);
    expect(res.body.data.TongTienPhong).toBe(12_000_000);
    expect(res.body.data.TongTienThanhToan).toBe(12_000_000);

    const row = await prisma().dAT_PHONG.findUniqueOrThrow({ where: { MaDatPhong: res.body.data.MaDatPhong } });
    expect(Number(row.TongTienPhong)).toBe(12_000_000);
    expect(Number(row.TongTienThanhToan)).toBe(12_000_000);

    // The owner reprices every night (and today) after the booking exists.
    await setRate(room, 0, 1);
    await setRate(room, 3, 9_000_000);
    await setRate(room, 4, 9_000_000);
    await setRate(room, 5, 9_000_000);

    const detail = await request(app).get(`/api/bookings/${res.body.data.MaDatPhong}`).set('Authorization', `Bearer ${customerToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.TongTienThanhToan).toBe(12_000_000);
    const stored = await prisma().dAT_PHONG.findUniqueOrThrow({ where: { MaDatPhong: res.body.data.MaDatPhong } });
    expect(Number(stored.TongTienThanhToan)).toBe(12_000_000);
  });

  it('bills a booking made today for a far-future stay at the future night\'s price', async () => {
    const room = await newRoomType();
    await setRate(room, 0, TODAY_PRICE);
    await setRate(room, 60, 3_300_000);

    const res = await book(60, 61, [{ maLoaiPhong: room, soLuong: 1 }]);
    expect(res.status).toBe(201);
    expect(res.body.data.TongTienPhong).toBe(3_300_000);
  });

  it('refuses the booking instead of borrowing another date\'s price when a stayed night has no open rate', async () => {
    const closed = await priceStayRoom([1_000_000, 2_000_000, 3_000_000]);
    await setRate(closed, 4, 2_000_000, 5, ROOM_RATE_STATUS.CLOSED);
    const closedRes = await book(3, 6, [{ maLoaiPhong: closed, soLuong: 1 }]);
    expect(closedRes.status).toBe(409);

    const gap = await priceStayRoom([1_000_000, 2_000_000, 3_000_000]);
    await prisma().qUY_PHONG_GIA.delete({ where: { MaLoaiPhong_NgayApDung: { MaLoaiPhong: gap, NgayApDung: addDays(4) } } });
    const gapRes = await book(3, 6, [{ maLoaiPhong: gap, soLuong: 1 }]);
    expect(gapRes.status).toBe(409);

    const count = await prisma().dAT_PHONG.count({ where: { CHI_TIET_DAT_PHONG: { some: { MaLoaiPhong: { in: [closed, gap] } } } } });
    expect(count).toBe(0);
  });

  it('a quote and the booking made right after it agree to the dong, with several room types', async () => {
    const roomA = await priceStayRoom([1_000_000, 2_000_000, 3_000_000]);
    const roomB = await priceStayRoom([400_000, 400_000, 1_000_000]);
    const rooms = [{ maLoaiPhong: roomA, soLuong: 1 }, { maLoaiPhong: roomB, soLuong: 3 }];

    const q = await quote(3, 6, rooms);
    const b = await book(3, 6, rooms);

    expect(q.body.data.TongTienPhong).toBe(6_000_000 + 3 * 1_800_000);
    expect(b.status).toBe(201);
    expect(b.body.data.TongTienPhong).toBe(q.body.data.TongTienPhong);
  });
});
