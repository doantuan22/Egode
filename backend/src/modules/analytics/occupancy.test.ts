import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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
import { AnalyticsRepository } from './analytics.repository';

/**
 * Bug #14 — occupancy = room-nights sold / room-nights in stock × 100, numerator and denominator counted per
 * (room type, night) from the same rows: only "Đã xác nhận" + "Hoàn tất" are sold, every stock row counts
 * (closed nights too), a night is never more than full, so the rate cannot exceed 100 %.
 */
const D = (n: number) => new Date(Date.UTC(2031, 2, n)); // 1 March 2031 + (n-1) days, as a DATE value
const prisma = () => getPrismaClient();
const repo = new AnalyticsRepository();

const accountIds: number[] = [];
let diaPhuongId = 0;
let hotelId = 0;
let policyId = 0;
let customerId = 0;
let ownerToken = '';
let roomTypes: number[] = [];

beforeAll(async () => {
  const owner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(owner.account.MaTaiKhoan, customer.account.MaTaiKhoan);
  customerId = customer.account.MaTaiKhoan;
  ownerToken = (await request(app).post('/api/auth/login').send({ identifier: owner.account.Email, MatKhau: owner.plainPassword })).body.data.accessToken;
  diaPhuongId = (await createTestDiaPhuong()).MaDiaPhuong;
  hotelId = (await createTestHotel(owner.account.MaTaiKhoan, diaPhuongId)).MaKhachSan;
  policyId = (await createTestCancellationPolicy([{ soGioTruocNhanPhong: 24, tyLeHoanTien: 100 }])).MaChinhSachHuy;
});

beforeEach(async () => {
  await prisma().cHI_TIET_DAT_PHONG.deleteMany({ where: { DAT_PHONG: { MaKhachSan: hotelId } } });
  await prisma().dAT_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });
  await prisma().qUY_PHONG_GIA.deleteMany({ where: { LOAI_PHONG: { MaKhachSan: hotelId } } });
  await prisma().lOAI_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });
  roomTypes = [];
});

afterAll(async () => {
  await prisma().cHI_TIET_DAT_PHONG.deleteMany({ where: { DAT_PHONG: { MaKhachSan: hotelId } } });
  await prisma().dAT_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });
  await deleteTestCancellationPolicy(policyId);
  await deleteTestHotel(hotelId);
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await deleteTestDiaPhuong(diaPhuongId);
});

const newRoomType = async () => {
  const id = (await createTestRoomType(hotelId)).MaLoaiPhong;
  roomTypes.push(id);
  return id;
};
/** Stock rows for one room type: night n (1-based, March 2031) → rooms, optionally closed for sale. */
const stock = async (roomType: number, nights: Record<number, number>, closed: number[] = []) => {
  for (const [night, rooms] of Object.entries(nights)) {
    await prisma().qUY_PHONG_GIA.create({
      data: {
        MaLoaiPhong: roomType, NgayApDung: D(Number(night)), GiaPhong: 500000, SoLuongPhong: rooms,
        TrangThai: closed.includes(Number(night)) ? ROOM_RATE_STATUS.CLOSED : ROOM_RATE_STATUS.OPEN_FOR_SALE,
      },
    });
  }
};
/** `rooms` rooms of `roomType` from night `from` up to (not including) night `to`. */
const sell = async (roomType: number, rooms: number, from: number, to: number, trangThai: string = BOOKING_STATUS.CONFIRMED) => {
  const booking = await createTestBookingDirect(customerId, hotelId, policyId, D(from), D(to), { trangThai });
  await prisma().cHI_TIET_DAT_PHONG.create({ data: { MaDatPhong: booking.MaDatPhong, MaLoaiPhong: roomType, SoLuongPhong: rooms } });
};
/** Occupancy of the hotel over nights `from`..`to` (inclusive). */
const occupancy = (from = 1, to = 31) => repo.occupancy({ maKhachSan: hotelId, from: D(from), to: D(to + 1) });

describe('the formula', () => {
  it('0 % when there is stock and nothing sold', async () => {
    const rt = await newRoomType();
    await stock(rt, { 1: 4, 2: 4, 3: 4 });
    expect(await occupancy()).toEqual({ TongPhongDem: 0, TongPhongCoTheBan: 12, TyLeLapDay: 0 });
  });

  it('100 % when every room of every night is sold', async () => {
    const rt = await newRoomType();
    await stock(rt, { 1: 4, 2: 4, 3: 4 });
    await sell(rt, 4, 1, 4); // nights 1,2,3
    expect(await occupancy()).toEqual({ TongPhongDem: 12, TongPhongCoTheBan: 12, TyLeLapDay: 100 });
  });

  it('different stock per night and per room type: sold / total, exactly', async () => {
    const a = await newRoomType();
    const b = await newRoomType();
    await stock(a, { 1: 2, 2: 4, 3: 6 }); // 12
    await stock(b, { 1: 3, 2: 3 }); // 6
    await sell(a, 2, 1, 4); // 2 + 2 + 2 = 6
    await sell(a, 1, 3, 4); // night 3: +1 → 7 for a
    await sell(b, 3, 2, 3); // night 2 of b: 3
    // sold = 7 + 3 = 10 of 18
    expect(await occupancy()).toEqual({ TongPhongDem: 10, TongPhongCoTheBan: 18, TyLeLapDay: 55.56 });
  });

  it('"Đã xác nhận" and "Hoàn tất" count; "Chờ thanh toán" and "Đã hủy" do not', async () => {
    const rt = await newRoomType();
    await stock(rt, { 1: 10, 2: 10 });
    await sell(rt, 1, 1, 2, BOOKING_STATUS.CONFIRMED);
    await sell(rt, 2, 1, 2, BOOKING_STATUS.COMPLETED);
    await sell(rt, 4, 1, 2, BOOKING_STATUS.CANCELLED);
    await sell(rt, 3, 1, 2, BOOKING_STATUS.PENDING_PAYMENT);
    expect(await occupancy()).toEqual({ TongPhongDem: 3, TongPhongCoTheBan: 20, TyLeLapDay: 15 });
  });
});

describe('stock rows are never dropped', () => {
  it('a night closed for sale still counts in the denominator (its rooms existed)', async () => {
    const rt = await newRoomType();
    await stock(rt, { 1: 4, 2: 4, 3: 4, 4: 4 }, [4]);
    await sell(rt, 4, 1, 3); // nights 1-2 full
    // 8 sold of 16 — not 8 of 12, which would hide the closed night
    expect(await occupancy()).toEqual({ TongPhongDem: 8, TongPhongCoTheBan: 16, TyLeLapDay: 50 });
  });

  it('rooms sold on a night that was closed afterwards still count as sold (history is kept)', async () => {
    const rt = await newRoomType();
    await stock(rt, { 1: 4, 2: 4 }, [1]);
    await sell(rt, 3, 1, 3);
    expect(await occupancy()).toEqual({ TongPhongDem: 6, TongPhongCoTheBan: 8, TyLeLapDay: 75 });
  });
});

describe('it can never exceed 100 %', () => {
  it('a night that old data shows as overbooked counts as full, not more than full', async () => {
    const rt = await newRoomType();
    await stock(rt, { 1: 3, 2: 3 });
    await sell(rt, 5, 1, 2); // 5 booked on a 3-room night (legacy overbooking)
    await sell(rt, 2, 2, 3);
    const result = await occupancy();
    expect(result).toEqual({ TongPhongDem: 5, TongPhongCoTheBan: 6, TyLeLapDay: 83.33 }); // 3 (capped) + 2
    expect(result.TyLeLapDay!).toBeLessThanOrEqual(100);
    // the stored data was not touched to get that answer
    expect((await prisma().cHI_TIET_DAT_PHONG.aggregate({ where: { MaLoaiPhong: rt }, _sum: { SoLuongPhong: true } }))._sum.SoLuongPhong).toBe(7);
  });

  it('nights without a stock row (old bookings from before the calendar existed) are ignored, not added to the numerator', async () => {
    const rt = await newRoomType();
    await stock(rt, { 2: 2 });
    await sell(rt, 2, 1, 4); // nights 1,2,3 — only night 2 has stock
    expect(await occupancy()).toEqual({ TongPhongDem: 2, TongPhongCoTheBan: 2, TyLeLapDay: 100 });
  });

  it('a booking that sticks out of the range is clipped to the range on both sides', async () => {
    const rt = await newRoomType();
    await stock(rt, { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2 });
    await sell(rt, 2, 1, 6); // nights 1..5
    expect(await occupancy(2, 3)).toEqual({ TongPhongDem: 4, TongPhongCoTheBan: 4, TyLeLapDay: 100 });
    expect(await occupancy(4, 5)).toEqual({ TongPhongDem: 4, TongPhongCoTheBan: 4, TyLeLapDay: 100 });
  });

  it('holds for many random scenarios: always between 0 and 100, numerator <= denominator', async () => {
    let seed = 20310301;
    const rand = (max: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % (max + 1));
    for (let round = 0; round < 6; round++) {
      await prisma().cHI_TIET_DAT_PHONG.deleteMany({ where: { DAT_PHONG: { MaKhachSan: hotelId } } });
      await prisma().dAT_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });
      await prisma().qUY_PHONG_GIA.deleteMany({ where: { LOAI_PHONG: { MaKhachSan: hotelId } } });
      const rt = roomTypes[0] ?? (await newRoomType());
      const nights: Record<number, number> = {};
      for (let n = 1; n <= 8; n++) if (rand(4) > 0) nights[n] = rand(6);
      await stock(rt, nights, [rand(8) || 1]);
      for (let i = 0; i < 5; i++) {
        const from = 1 + rand(6);
        const status = [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED, BOOKING_STATUS.PENDING_PAYMENT][rand(3)];
        await sell(rt, 1 + rand(8), from, from + 1 + rand(3), status);
      }
      const { TongPhongDem, TongPhongCoTheBan, TyLeLapDay } = await occupancy();
      expect(TongPhongDem).toBeLessThanOrEqual(TongPhongCoTheBan);
      if (TyLeLapDay !== null) {
        expect(TyLeLapDay).toBeGreaterThanOrEqual(0);
        expect(TyLeLapDay).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('edge cases and the API', () => {
  it('null (not 0 %) when the hotel has no stock at all, or none in the range', async () => {
    expect(await occupancy()).toEqual({ TongPhongDem: 0, TongPhongCoTheBan: 0, TyLeLapDay: null });
    const rt = await newRoomType();
    await stock(rt, { 20: 4 });
    expect((await occupancy(1, 10)).TyLeLapDay).toBeNull();
  });

  it('the owner analytics endpoint reports the same figures', async () => {
    const rt = await newRoomType();
    await stock(rt, { 1: 4, 2: 4 }, [2]);
    await sell(rt, 2, 1, 3);
    await sell(rt, 4, 1, 2, BOOKING_STATUS.CANCELLED);
    const res = await request(app).get(`/api/owner/hotels/${hotelId}/analytics`).query({ from: '2031-03-01', to: '2031-03-02' }).set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ TongPhongDem: 4, TongPhongCoTheBan: 8, TyLeLapDay: 50 });
  });
});
