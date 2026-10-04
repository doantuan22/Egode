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
  createTestPromotion,
  deleteTestPromotion,
} from '../../test/factories';
import { getPrismaClient } from '../../config/prisma';
import { env } from '../../config/env';
import { ROLE_NAMES } from '../../common/constants/roles';
import { ROOM_RATE_STATUS, BOOKING_STATUS } from '../../common/constants/hotel-status';
import { addDaysToDateKey, businessToday } from '../../common/utils/stay-dates';

// "Today" is the business-time-zone day (Asia/Ho_Chi_Minh) — the same day the API validates stay dates against.
const addDays = (days: number): Date => new Date(`${addDaysToDateKey(businessToday(), days)}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

const loginAndGetToken = async (email: string, password: string) => {
  const res = await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password });
  return res.body.data.accessToken as string;
};

const accountIds: number[] = [];
const diaPhuongIds: number[] = [];
const hotelIds: number[] = [];
const promotionIds: number[] = [];

let hotelId: number;
let customerToken: string;
let ownerToken: string;
let roomA: number; // priced days 0-9, generous stock (5)
let roomD: number; // priced days 0-9, generous stock (5) — paired with roomA for multi-room-type test
let roomSoldOut: number; // priced days 0-9, only 1 room of stock
let roomRace: number; // priced, only 1 room of stock — dedicated to the concurrency test
let roomPriceChange: number; // priced day 0, price will be changed after "quote" before booking
let roomCancelTest: number; // priced day 0, only 1 room of stock
let roomUnpriced: number; // priced days 0-3 and 5-9, missing day 4

beforeAll(async () => {
  const owner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  accountIds.push(owner.account.MaTaiKhoan);
  ownerToken = await loginAndGetToken(owner.account.Email, owner.plainPassword);

  const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(customer.account.MaTaiKhoan);
  customerToken = await loginAndGetToken(customer.account.Email, customer.plainPassword);

  const diaPhuong = await createTestDiaPhuong();
  diaPhuongIds.push(diaPhuong.MaDiaPhuong);
  const hotel = await createTestHotel(owner.account.MaTaiKhoan, diaPhuong.MaDiaPhuong);
  hotelIds.push(hotel.MaKhachSan);
  hotelId = hotel.MaKhachSan;

  const [rtA, rtD, rtSoldOut, rtRace, rtPriceChange, rtCancel, rtUnpriced] = await Promise.all([
    createTestRoomType(hotel.MaKhachSan),
    createTestRoomType(hotel.MaKhachSan),
    createTestRoomType(hotel.MaKhachSan),
    createTestRoomType(hotel.MaKhachSan),
    createTestRoomType(hotel.MaKhachSan),
    createTestRoomType(hotel.MaKhachSan),
    createTestRoomType(hotel.MaKhachSan),
  ]);
  roomA = rtA.MaLoaiPhong;
  roomD = rtD.MaLoaiPhong;
  roomSoldOut = rtSoldOut.MaLoaiPhong;
  roomRace = rtRace.MaLoaiPhong;
  roomPriceChange = rtPriceChange.MaLoaiPhong;
  roomCancelTest = rtCancel.MaLoaiPhong;
  roomUnpriced = rtUnpriced.MaLoaiPhong;

  const prisma = getPrismaClient();

  for (let i = 0; i < 10; i++) {
    await prisma.qUY_PHONG_GIA.create({
      data: { MaLoaiPhong: roomA, NgayApDung: addDays(i), GiaPhong: 500000, SoLuongPhong: 5, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE },
    });
    await prisma.qUY_PHONG_GIA.create({
      data: { MaLoaiPhong: roomD, NgayApDung: addDays(i), GiaPhong: 300000, SoLuongPhong: 5, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE },
    });
    await prisma.qUY_PHONG_GIA.create({
      data: { MaLoaiPhong: roomSoldOut, NgayApDung: addDays(i), GiaPhong: 800000, SoLuongPhong: 1, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE },
    });
    await prisma.qUY_PHONG_GIA.create({
      data: { MaLoaiPhong: roomRace, NgayApDung: addDays(i), GiaPhong: 900000, SoLuongPhong: 1, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE },
    });
    await prisma.qUY_PHONG_GIA.create({
      data: { MaLoaiPhong: roomCancelTest, NgayApDung: addDays(i), GiaPhong: 400000, SoLuongPhong: 1, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE },
    });
    if (i !== 4) {
      await prisma.qUY_PHONG_GIA.create({
        data: { MaLoaiPhong: roomUnpriced, NgayApDung: addDays(i), GiaPhong: 600000, SoLuongPhong: 3, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE },
      });
    }
  }

  await prisma.qUY_PHONG_GIA.create({
    data: { MaLoaiPhong: roomPriceChange, NgayApDung: addDays(0), GiaPhong: 500000, SoLuongPhong: 5, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE },
  });
});

afterAll(async () => {
  const prisma = getPrismaClient();
  const roomIds = [roomA, roomD, roomSoldOut, roomRace, roomPriceChange, roomCancelTest, roomUnpriced];
  await prisma.cHI_TIET_DAT_PHONG.deleteMany({ where: { MaLoaiPhong: { in: roomIds } } });
  await prisma.dAT_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });

  await Promise.all(promotionIds.map((id) => deleteTestPromotion(id)));
  await Promise.all(hotelIds.map((id) => deleteTestHotel(id)));
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await Promise.all(diaPhuongIds.map((id) => deleteTestDiaPhuong(id)));
});

describe('POST /api/hotels/:id/bookings — RBAC', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app)
      .post(`/api/hotels/${hotelId}/bookings`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(1)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }] });
    expect(res.status).toBe(401);
  });

  it('rejects a non-customer account (e.g. a Chủ khách sạn token)', async () => {
    const res = await request(app)
      .post(`/api/hotels/${hotelId}/bookings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(1)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }] });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/hotels/:id/bookings — valid booking', () => {
  it('creates a real DAT_PHONG with server-computed totals and starts at Chờ thanh toán', async () => {
    const res = await request(app)
      .post(`/api/hotels/${hotelId}/bookings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(1)), rooms: [{ maLoaiPhong: roomA, soLuong: 2 }], ghiChu: 'Late check-in' });

    expect(res.status).toBe(201);
    expect(res.body.data.MaXacNhanDatPhong).toMatch(/^BK/);
    expect(res.body.data.SoDem).toBe(1);
    expect(res.body.data.TongTienPhong).toBe(1_000_000); // 500k x 1 night x 2 rooms
    expect(res.body.data.TongTienThanhToan).toBe(1_000_000);
    expect(res.body.data.TrangThai).toBe(BOOKING_STATUS.PENDING_PAYMENT);
    expect(res.body.data.ChinhSachHuy).not.toBeNull();

    // The payment hold: exactly the instant the booking will be auto-cancelled (NgayTao + PAYMENT_TIMEOUT_MINUTES).
    const holdMs = env.PAYMENT_TIMEOUT_MINUTES * 60_000;
    expect(res.body.data.HanThanhToan).toBe(new Date(new Date(res.body.data.NgayTao).getTime() + holdMs).toISOString());
    expect(res.body.data.SoGiayConLai).toBeGreaterThan(0);
    expect(res.body.data.SoGiayConLai).toBeLessThanOrEqual(env.PAYMENT_TIMEOUT_MINUTES * 60);

    const prisma = getPrismaClient();
    const row = await prisma.dAT_PHONG.findUnique({ where: { MaDatPhong: res.body.data.MaDatPhong } });
    expect(row?.TrangThai).toBe(BOOKING_STATUS.PENDING_PAYMENT);
    expect(row?.GhiChu).toBe('Late check-in');
  });

  it('books multiple room types in a single request', async () => {
    const res = await request(app)
      .post(`/api/hotels/${hotelId}/bookings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        checkIn: iso(addDays(1)),
        checkOut: iso(addDays(2)),
        rooms: [
          { maLoaiPhong: roomA, soLuong: 1 }, // 500k
          { maLoaiPhong: roomD, soLuong: 2 }, // 300k x 2 = 600k
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.ChiTietPhong).toHaveLength(2);
    expect(res.body.data.TongTienPhong).toBe(1_100_000);

    const prisma = getPrismaClient();
    const lines = await prisma.cHI_TIET_DAT_PHONG.findMany({ where: { MaDatPhong: res.body.data.MaDatPhong } });
    expect(lines).toHaveLength(2);
  });
});

describe('POST /api/hotels/:id/bookings — validation errors (no rows left behind)', () => {
  it('rejects an invalid date range', async () => {
    const res = await request(app)
      .post(`/api/hotels/${hotelId}/bookings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ checkIn: iso(addDays(5)), checkOut: iso(addDays(5)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }] });
    expect(res.status).toBe(400);
  });

  it('rejects a room type id that does not belong to this hotel', async () => {
    const res = await request(app)
      .post(`/api/hotels/${hotelId}/bookings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(1)), rooms: [{ maLoaiPhong: 999999999, soLuong: 1 }] });
    expect(res.status).toBe(400);
  });

  it('rejects a stay spanning a night with no QUY_PHONG_GIA row, leaving no DAT_PHONG behind', async () => {
    const prisma = getPrismaClient();
    const before = await prisma.dAT_PHONG.count({ where: { MaKhachSan: hotelId } });

    const res = await request(app)
      .post(`/api/hotels/${hotelId}/bookings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ checkIn: iso(addDays(3)), checkOut: iso(addDays(6)), rooms: [{ maLoaiPhong: roomUnpriced, soLuong: 1 }] }); // spans missing day 4

    expect(res.status).toBe(409);
    const after = await prisma.dAT_PHONG.count({ where: { MaKhachSan: hotelId } });
    expect(after).toBe(before); // rolled back — no orphan row
  });
});

describe('POST /api/hotels/:id/bookings — availability & rollback', () => {
  it('rejects a booking that exceeds remaining stock, and leaves no DAT_PHONG/CHI_TIET_DAT_PHONG behind', async () => {
    // Consume the only room first.
    const first = await request(app)
      .post(`/api/hotels/${hotelId}/bookings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ checkIn: iso(addDays(5)), checkOut: iso(addDays(6)), rooms: [{ maLoaiPhong: roomSoldOut, soLuong: 1 }] });
    expect(first.status).toBe(201);

    const prisma = getPrismaClient();
    const before = await prisma.dAT_PHONG.count({ where: { MaKhachSan: hotelId } });

    const second = await request(app)
      .post(`/api/hotels/${hotelId}/bookings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ checkIn: iso(addDays(5)), checkOut: iso(addDays(6)), rooms: [{ maLoaiPhong: roomSoldOut, soLuong: 1 }] });

    expect(second.status).toBe(409);
    const after = await prisma.dAT_PHONG.count({ where: { MaKhachSan: hotelId } });
    expect(after).toBe(before); // the failed attempt created nothing
  });

  it('a cancelled booking does not occupy inventory — a new booking for the same slot still succeeds', async () => {
    const prisma = getPrismaClient();
    const policy = await prisma.cHINH_SACH_HUY.findFirst();
    const ghost = await prisma.dAT_PHONG.create({
      data: {
        MaXacNhanDatPhong: `BK-CANCELLED-${Date.now()}`,
        TAI_KHOAN: { connect: { MaTaiKhoan: accountIds[1] } },
        KHACH_SAN: { connect: { MaKhachSan: hotelId } },
        CHINH_SACH_HUY: { connect: { MaChinhSachHuy: policy!.MaChinhSachHuy } },
        NgayNhanPhong: addDays(0),
        NgayTraPhong: addDays(1),
        TongTienPhong: 400000,
        SoTienGiam: 0,
        TongTienThanhToan: 400000,
        TrangThai: BOOKING_STATUS.CANCELLED,
        NgayTao: new Date(),
        NgayCapNhat: new Date(),
      },
    });
    await prisma.cHI_TIET_DAT_PHONG.create({ data: { MaDatPhong: ghost.MaDatPhong, MaLoaiPhong: roomCancelTest, SoLuongPhong: 1 } });

    const res = await request(app)
      .post(`/api/hotels/${hotelId}/bookings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(1)), rooms: [{ maLoaiPhong: roomCancelTest, soLuong: 1 }] });

    expect(res.status).toBe(201); // the only room is "free" because the existing booking is cancelled
  });

  it('recomputes at the current price, ignoring whatever price a stale quote may have shown', async () => {
    // Simulate the owner changing the price after the customer already saw a quote.
    await getPrismaClient().qUY_PHONG_GIA.update({
      where: { MaLoaiPhong_NgayApDung: { MaLoaiPhong: roomPriceChange, NgayApDung: addDays(0) } },
      data: { GiaPhong: 700000 },
    });

    const res = await request(app)
      .post(`/api/hotels/${hotelId}/bookings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(1)), rooms: [{ maLoaiPhong: roomPriceChange, soLuong: 1 }] });

    expect(res.status).toBe(201);
    expect(res.body.data.TongTienPhong).toBe(700_000); // new price, not the 500k it was created with
  });
});

describe('POST /api/hotels/:id/bookings — promotions', () => {
  it('rejects an expired promo code outright (does not silently book at full price)', async () => {
    const promo = await createTestPromotion({ ngayBatDau: addDays(-60), ngayKetThuc: addDays(-1) });
    promotionIds.push(promo.MaKhuyenMai);

    const prisma = getPrismaClient();
    const before = await prisma.dAT_PHONG.count({ where: { MaKhachSan: hotelId } });

    const res = await request(app)
      .post(`/api/hotels/${hotelId}/bookings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ checkIn: iso(addDays(2)), checkOut: iso(addDays(3)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }], promoCode: promo.MaCode });

    expect(res.status).toBe(400);
    const after = await prisma.dAT_PHONG.count({ where: { MaKhachSan: hotelId } });
    expect(after).toBe(before);
  });

  it('rejects an unknown promo code', async () => {
    const res = await request(app)
      .post(`/api/hotels/${hotelId}/bookings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ checkIn: iso(addDays(2)), checkOut: iso(addDays(3)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }], promoCode: 'DOES_NOT_EXIST_XYZ' });
    expect(res.status).toBe(400);
  });

  it('applies a valid promo and persists MaKhuyenMai/SoTienGiam on the booking', async () => {
    const promo = await createTestPromotion({ giaTriGiam: 10 });
    promotionIds.push(promo.MaKhuyenMai);

    const res = await request(app)
      .post(`/api/hotels/${hotelId}/bookings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ checkIn: iso(addDays(2)), checkOut: iso(addDays(3)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }], promoCode: promo.MaCode });

    expect(res.status).toBe(201);
    expect(res.body.data.KhuyenMai.MaCode).toBe(promo.MaCode);
    expect(res.body.data.SoTienGiam).toBe(50_000); // 10% of 500,000
    expect(res.body.data.TongTienThanhToan).toBe(450_000);

    const prisma = getPrismaClient();
    const row = await prisma.dAT_PHONG.findUnique({ where: { MaDatPhong: res.body.data.MaDatPhong } });
    expect(row?.MaKhuyenMai).toBe(promo.MaKhuyenMai);
  });
});

describe('POST /api/hotels/:id/bookings — concurrency (last room)', () => {
  it('two simultaneous requests for the last room result in exactly one commit', async () => {
    const payload = { checkIn: iso(addDays(0)), checkOut: iso(addDays(1)), rooms: [{ maLoaiPhong: roomRace, soLuong: 1 }] };

    const [res1, res2] = await Promise.all([
      request(app).post(`/api/hotels/${hotelId}/bookings`).set('Authorization', `Bearer ${customerToken}`).send(payload),
      request(app).post(`/api/hotels/${hotelId}/bookings`).set('Authorization', `Bearer ${customerToken}`).send(payload),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const prisma = getPrismaClient();
    const total = await prisma.cHI_TIET_DAT_PHONG.aggregate({
      where: { MaLoaiPhong: roomRace },
      _sum: { SoLuongPhong: true },
    });
    expect(total._sum.SoLuongPhong).toBe(1); // never both — no overbooking
  });
});
