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
import { ROLE_NAMES } from '../../common/constants/roles';
import { ROOM_RATE_STATUS, BOOKING_STATUS } from '../../common/constants/hotel-status';
import { addDaysToDateKey, businessToday } from '../../common/utils/stay-dates';

/**
 * BUG-001 — a promo's SoLuongGioiHan must hold under concurrent bookings.
 *
 * Every request in a burst books a DIFFERENT room type, on purpose: bookings of
 * one room type are already serialised by the QUY_PHONG_GIA lock, which would
 * hide the promo race. Distinct room types leave the KHUYEN_MAI row lock
 * (usp_KhoaKhuyenMaiChoDatPhong) as the only thing keeping the count honest.
 * Each burst uses a fresh promo and is repeated ROUNDS times, because a race
 * that fails 1 run in 20 must not slip through a single lucky pass.
 */

const ROUNDS = 8;
const MAX_BURST = 20;
const STOCK_PER_ROOM = 200; // never the limiting factor — only the promo limit may reject

// "Today" is the business-time-zone day (Asia/Ho_Chi_Minh) — the same day the API validates stay dates against.
const addDays = (days: number): Date => new Date(`${addDaysToDateKey(businessToday(), days)}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

const accountIds: number[] = [];
const diaPhuongIds: number[] = [];
const hotelIds: number[] = [];
const promotionIds: number[] = [];

let hotelId: number;
let customerToken: string;
let roomIds: number[] = []; // MAX_BURST room types, one per concurrent request

const post = (roomId: number, promoCode?: string) =>
  request(app)
    .post(`/api/hotels/${hotelId}/bookings`)
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      checkIn: iso(addDays(0)),
      checkOut: iso(addDays(1)),
      rooms: [{ maLoaiPhong: roomId, soLuong: 1 }],
      ...(promoCode ? { promoCode } : {}),
    });

const newPromo = async (soLuongGioiHan: number) => {
  const promo = await createTestPromotion({ soLuongGioiHan });
  promotionIds.push(promo.MaKhuyenMai);
  return promo;
};

/** The invariant under test: valid (non-cancelled) bookings using the promo. */
const validPromoBookings = (maKhuyenMai: number) =>
  getPrismaClient().dAT_PHONG.count({ where: { MaKhuyenMai: maKhuyenMai, TrangThai: { not: BOOKING_STATUS.CANCELLED } } });

const countByStatus = (responses: Array<{ status: number }>) => {
  const counts: Record<number, number> = {};
  for (const r of responses) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return counts;
};

beforeAll(async () => {
  const owner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  accountIds.push(owner.account.MaTaiKhoan);
  const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(customer.account.MaTaiKhoan);
  const login = await request(app).post('/api/auth/login').send({ identifier: customer.account.Email, MatKhau: customer.plainPassword });
  customerToken = login.body.data.accessToken as string;

  const diaPhuong = await createTestDiaPhuong();
  diaPhuongIds.push(diaPhuong.MaDiaPhuong);
  const hotel = await createTestHotel(owner.account.MaTaiKhoan, diaPhuong.MaDiaPhuong);
  hotelIds.push(hotel.MaKhachSan);
  hotelId = hotel.MaKhachSan;

  const roomTypes = await Promise.all(Array.from({ length: MAX_BURST }, () => createTestRoomType(hotel.MaKhachSan)));
  roomIds = roomTypes.map((rt) => rt.MaLoaiPhong);
  await getPrismaClient().qUY_PHONG_GIA.createMany({
    data: roomIds.map((MaLoaiPhong) => ({
      MaLoaiPhong,
      NgayApDung: addDays(0),
      GiaPhong: 500000,
      SoLuongPhong: STOCK_PER_ROOM,
      TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE,
    })),
  });
}, 60_000);

afterAll(async () => {
  const prisma = getPrismaClient();
  await prisma.cHI_TIET_DAT_PHONG.deleteMany({ where: { MaLoaiPhong: { in: roomIds } } });
  await prisma.dAT_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });
  await Promise.all(promotionIds.map((id) => deleteTestPromotion(id)));
  await Promise.all(hotelIds.map((id) => deleteTestHotel(id)));
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await Promise.all(diaPhuongIds.map((id) => deleteTestDiaPhuong(id)));
}, 60_000);

describe('POST /api/hotels/:id/bookings — promo usage limit under concurrency (BUG-001)', () => {
  const cases = [
    { name: 'Case 1: limit=2, 5 concurrent requests', limit: 2, burst: 5 },
    { name: 'Case 2: limit=1, 10 concurrent requests', limit: 1, burst: 10 },
    { name: 'Case 3: limit=2, 20 concurrent requests', limit: 2, burst: 20 },
  ];

  for (const { name, limit, burst } of cases) {
    it(`${name} (x${ROUNDS} rounds) never exceeds the limit`, async () => {
      for (let round = 1; round <= ROUNDS; round++) {
        const promo = await newPromo(limit);
        const responses = await Promise.all(roomIds.slice(0, burst).map((roomId) => post(roomId, promo.MaCode)));

        const used = await validPromoBookings(promo.MaKhuyenMai);
        const counts = countByStatus(responses);
        const context = `round ${round}: used=${used} statuses=${JSON.stringify(counts)}`;

        expect(used, context).toBeLessThanOrEqual(limit); // the invariant
        expect(responses.filter((r) => r.status === 201).length, context).toBe(used); // every 201 is a persisted booking
        // Nothing but a clean accept or a clean "promo exhausted" reject: no 409/500/timeouts.
        expect(responses.every((r) => r.status === 201 || r.status === 400), context).toBe(true);
        // Not over-restrictive either: with ample stock exactly `limit` requests win.
        expect(used, context).toBe(limit);
        for (const r of responses.filter((x) => x.status === 400)) {
          expect(r.body.message).toMatch(/hết lượt/);
        }
      }
    }, 120_000);
  }

  it('leaves no DAT_PHONG / CHI_TIET_DAT_PHONG behind for rejected requests', async () => {
    const prisma = getPrismaClient();
    const promo = await newPromo(2);
    const bookingsBefore = await prisma.dAT_PHONG.count({ where: { MaKhachSan: hotelId } });
    const linesBefore = await prisma.cHI_TIET_DAT_PHONG.count({ where: { MaLoaiPhong: { in: roomIds } } });

    const responses = await Promise.all(roomIds.map((roomId) => post(roomId, promo.MaCode)));
    const accepted = responses.filter((r) => r.status === 201).length;
    expect(accepted).toBe(2);
    expect(responses.filter((r) => r.status === 400)).toHaveLength(MAX_BURST - 2);

    expect(await prisma.dAT_PHONG.count({ where: { MaKhachSan: hotelId } })).toBe(bookingsBefore + accepted);
    expect(await prisma.cHI_TIET_DAT_PHONG.count({ where: { MaLoaiPhong: { in: roomIds } } })).toBe(linesBefore + accepted);
    // Every booking of this promo has its detail line (no header without lines).
    const orphans = await prisma.dAT_PHONG.count({ where: { MaKhuyenMai: promo.MaKhuyenMai, CHI_TIET_DAT_PHONG: { none: {} } } });
    expect(orphans).toBe(0);
  }, 120_000);

  it('bookings without a promo are unaffected, even while a promo is exhausted', async () => {
    const promo = await newPromo(1);
    const promoRooms = roomIds.slice(0, 10);
    const plainRooms = roomIds.slice(10, 15);

    const responses = await Promise.all([
      ...promoRooms.map((roomId) => post(roomId, promo.MaCode)),
      ...plainRooms.map((roomId) => post(roomId)),
    ]);

    const promoResponses = responses.slice(0, promoRooms.length);
    const plainResponses = responses.slice(promoRooms.length);
    expect(plainResponses.every((r) => r.status === 201)).toBe(true);
    expect(await validPromoBookings(promo.MaKhuyenMai)).toBe(1);
    expect(promoResponses.filter((r) => r.status === 201)).toHaveLength(1);
  }, 120_000);

  it('two different promos are limited independently, each exactly to its own limit', async () => {
    for (let round = 1; round <= ROUNDS; round++) {
      const promoA = await newPromo(1);
      const promoB = await newPromo(2);
      const roomsA = roomIds.slice(0, 8);
      const roomsB = roomIds.slice(8, 16);

      await Promise.all([
        ...roomsA.map((roomId) => post(roomId, promoA.MaCode)),
        ...roomsB.map((roomId) => post(roomId, promoB.MaCode)),
      ]);

      expect(await validPromoBookings(promoA.MaKhuyenMai), `round ${round} promo A`).toBe(1);
      expect(await validPromoBookings(promoB.MaKhuyenMai), `round ${round} promo B`).toBe(2);
    }
  }, 120_000);

  it('a cancelled promo booking frees its slot and still never exceeds the limit afterwards', async () => {
    const prisma = getPrismaClient();
    const promo = await newPromo(1);

    const first = await post(roomIds[0], promo.MaCode);
    expect(first.status).toBe(201);
    expect((await post(roomIds[1], promo.MaCode)).status).toBe(400); // limit reached

    await prisma.dAT_PHONG.update({ where: { MaDatPhong: first.body.data.MaDatPhong }, data: { TrangThai: BOOKING_STATUS.CANCELLED } });

    const responses = await Promise.all(roomIds.slice(2, 8).map((roomId) => post(roomId, promo.MaCode)));
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await validPromoBookings(promo.MaKhuyenMai)).toBe(1); // cancelled one excluded, new one counted
  }, 120_000);
});
