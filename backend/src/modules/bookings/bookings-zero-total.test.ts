import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
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
import { DISCOUNT_TYPE } from '../../common/constants/commercial';
import { addDaysToDateKey, businessToday } from '../../common/utils/stay-dates';

/**
 * Bug #2 — a booking whose payable total is 0 (valid promotion, or a free rate) is confirmed directly:
 * no THANH_TOAN row (SoTien > 0 is a DB rule), no gateway call, never "Chờ thanh toán", never expired.
 */
const day = (offset: number) => addDaysToDateKey(businessToday(), offset);

const accountIds: number[] = [];
const promotionIds: number[] = [];
let diaPhuongId = 0;
let hotelId = 0;
let paidRoom = 0; // 500.000đ / night
let freeRoom = 0; // 0đ / night
let customerToken = '';

const login = async (email: string, password: string) =>
  (await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password })).body.data.accessToken as string;

beforeAll(async () => {
  const owner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(owner.account.MaTaiKhoan, customer.account.MaTaiKhoan);
  customerToken = await login(customer.account.Email, customer.plainPassword);

  diaPhuongId = (await createTestDiaPhuong()).MaDiaPhuong;
  hotelId = (await createTestHotel(owner.account.MaTaiKhoan, diaPhuongId)).MaKhachSan;
  paidRoom = (await createTestRoomType(hotelId)).MaLoaiPhong;
  freeRoom = (await createTestRoomType(hotelId)).MaLoaiPhong;

  const prisma = getPrismaClient();
  for (let i = 0; i < 6; i++) {
    const NgayApDung = new Date(`${day(i)}T00:00:00Z`);
    await prisma.qUY_PHONG_GIA.create({ data: { MaLoaiPhong: paidRoom, NgayApDung, GiaPhong: 500000, SoLuongPhong: 50, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE } });
    await prisma.qUY_PHONG_GIA.create({ data: { MaLoaiPhong: freeRoom, NgayApDung, GiaPhong: 0, SoLuongPhong: 50, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE } });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  const prisma = getPrismaClient();
  await prisma.hOAN_TIEN.deleteMany({ where: { THANH_TOAN: { DAT_PHONG: { MaKhachSan: hotelId } } } });
  await prisma.tHANH_TOAN.deleteMany({ where: { DAT_PHONG: { MaKhachSan: hotelId } } });
  await prisma.cHI_TIET_DAT_PHONG.deleteMany({ where: { DAT_PHONG: { MaKhachSan: hotelId } } });
  await prisma.dAT_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });
  await Promise.all(promotionIds.map((id) => deleteTestPromotion(id)));
  await deleteTestHotel(hotelId);
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await deleteTestDiaPhuong(diaPhuongId);
});

const book = (room: number, promoCode?: string, nights = 1) =>
  request(app)
    .post(`/api/hotels/${hotelId}/bookings`)
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ checkIn: day(1), checkOut: day(1 + nights), rooms: [{ maLoaiPhong: room, soLuong: 1 }], promoCode });

const makePromo = async (options: Parameters<typeof createTestPromotion>[0]) => {
  const promo = await createTestPromotion(options);
  promotionIds.push(promo.MaKhuyenMai);
  return promo;
};

const paymentRows = (bookingId: number) => getPrismaClient().tHANH_TOAN.count({ where: { MaDatPhong: bookingId } });
const refundRows = (bookingId: number) => getPrismaClient().hOAN_TIEN.count({ where: { THANH_TOAN: { MaDatPhong: bookingId } } });

describe('a total of 0 confirms the booking directly', () => {
  it('percent promotion bringing the total to 0: confirmed, totals kept, no payment row', async () => {
    const promo = await makePromo({ loaiGiamGia: DISCOUNT_TYPE.PERCENT, giaTriGiam: 100 });
    const res = await book(paidRoom, promo.MaCode);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      TrangThai: BOOKING_STATUS.CONFIRMED,
      TongTienPhong: 500000,
      SoTienGiam: 500000,
      TongTienThanhToan: 0,
      HanThanhToan: null,
      SoGiayConLai: null,
      KhuyenMai: { MaCode: promo.MaCode },
    });

    const row = await getPrismaClient().dAT_PHONG.findUniqueOrThrow({ where: { MaDatPhong: res.body.data.MaDatPhong } });
    expect(row.TrangThai).toBe(BOOKING_STATUS.CONFIRMED);
    expect(Number(row.TongTienPhong)).toBe(500000);
    expect(Number(row.SoTienGiam)).toBe(500000);
    expect(Number(row.TongTienThanhToan)).toBe(0);
    expect(row.MaKhuyenMai).toBe(promo.MaKhuyenMai);
    expect(await paymentRows(row.MaDatPhong)).toBe(0);
  });

  it('fixed-amount promotion larger than the room total: discount is capped, total 0, confirmed', async () => {
    const promo = await makePromo({ loaiGiamGia: DISCOUNT_TYPE.FIXED_AMOUNT, giaTriGiam: 9_000_000 });
    const res = await book(paidRoom, promo.MaCode, 2);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ TrangThai: BOOKING_STATUS.CONFIRMED, TongTienPhong: 1_000_000, SoTienGiam: 1_000_000, TongTienThanhToan: 0 });
    expect(await paymentRows(res.body.data.MaDatPhong)).toBe(0);
  });

  it('a free rate (0đ / night) with no promotion is confirmed the same way', async () => {
    const res = await book(freeRoom);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ TrangThai: BOOKING_STATUS.CONFIRMED, TongTienPhong: 0, SoTienGiam: 0, TongTienThanhToan: 0, KhuyenMai: null });
    expect(await paymentRows(res.body.data.MaDatPhong)).toBe(0);
  });

  it('the quote already announces a total of 0 for that promotion', async () => {
    const promo = await makePromo({ loaiGiamGia: DISCOUNT_TYPE.PERCENT, giaTriGiam: 100 });
    const res = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({ checkIn: day(1), checkOut: day(2), rooms: [{ maLoaiPhong: paidRoom, soLuong: 1 }], promoCode: promo.MaCode });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ PromoHopLe: true, TongTienPhong: 500000, SoTienGiam: 500000, TongTienThanhToan: 0 });
  });

  it('never reaches the payment gateway: no outbound call while booking, and a payment attempt is refused without creating a row', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const promo = await makePromo({ loaiGiamGia: DISCOUNT_TYPE.PERCENT, giaTriGiam: 100 });
    const created = await book(paidRoom, promo.MaCode);
    expect(created.status).toBe(201);
    const bookingId = created.body.data.MaDatPhong as number;

    const pay = await request(app).post(`/api/bookings/${bookingId}/payments/vnpay`).set('Authorization', `Bearer ${customerToken}`);
    expect(pay.status).toBe(400);
    expect(await paymentRows(bookingId)).toBe(0);
    const gatewayCalls = fetchSpy.mock.calls.filter(([url]) => String(url).includes('vnpay'));
    expect(gatewayCalls).toHaveLength(0);
  });
});

describe('a 0đ booking is a normal confirmed booking afterwards', () => {
  it('is not cancelled by the 15-minute payment timeout, and shows in history/detail with total 0', async () => {
    const promo = await makePromo({ loaiGiamGia: DISCOUNT_TYPE.PERCENT, giaTriGiam: 100 });
    const created = await book(paidRoom, promo.MaCode);
    const bookingId = created.body.data.MaDatPhong as number;

    // Age it far beyond PAYMENT_TIMEOUT_MINUTES; every read below runs the expiry sweep.
    await getPrismaClient().dAT_PHONG.update({ where: { MaDatPhong: bookingId }, data: { NgayTao: new Date(Date.now() - 6 * 60 * 60 * 1000) } });

    const detail = await request(app).get(`/api/bookings/${bookingId}`).set('Authorization', `Bearer ${customerToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({ TrangThai: BOOKING_STATUS.CONFIRMED, TongTienThanhToan: 0, HanThanhToan: null, SoGiayConLai: null, ThanhToan: [] });

    const list = await request(app).get('/api/bookings').set('Authorization', `Bearer ${customerToken}`);
    const item = list.body.data.find((b: { MaDatPhong: number }) => b.MaDatPhong === bookingId);
    expect(item).toMatchObject({ TrangThai: BOOKING_STATUS.CONFIRMED, TongTienThanhToan: 0 });
  });

  it('counts as one use of the promotion at once (limit 1: a second booking is refused), and is not released by time', async () => {
    const promo = await makePromo({ loaiGiamGia: DISCOUNT_TYPE.PERCENT, giaTriGiam: 100, soLuongGioiHan: 1 });
    const first = await book(paidRoom, promo.MaCode);
    expect(first.status).toBe(201);

    await getPrismaClient().dAT_PHONG.update({ where: { MaDatPhong: first.body.data.MaDatPhong }, data: { NgayTao: new Date(Date.now() - 6 * 60 * 60 * 1000) } });
    await request(app).get('/api/bookings').set('Authorization', `Bearer ${customerToken}`); // runs the sweep

    const second = await book(paidRoom, promo.MaCode);
    expect(second.status).toBe(400);
    const used = await getPrismaClient().dAT_PHONG.count({ where: { MaKhuyenMai: promo.MaKhuyenMai, TrangThai: { not: BOOKING_STATUS.CANCELLED } } });
    expect(used).toBe(1);
  });

  it('parallel bookings never exceed the promotion limit even when each one is confirmed immediately', async () => {
    const promo = await makePromo({ loaiGiamGia: DISCOUNT_TYPE.PERCENT, giaTriGiam: 100, soLuongGioiHan: 2 });
    const results = await Promise.all(Array.from({ length: 5 }, () => book(paidRoom, promo.MaCode)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    const used = await getPrismaClient().dAT_PHONG.count({ where: { MaKhuyenMai: promo.MaKhuyenMai, TrangThai: { not: BOOKING_STATUS.CANCELLED } } });
    expect(used).toBe(2);
  });

  it('cancelling a 0đ booking cancels it without any refund or payment, and releases the promotion use', async () => {
    const promo = await makePromo({ loaiGiamGia: DISCOUNT_TYPE.PERCENT, giaTriGiam: 100, soLuongGioiHan: 1 });
    const created = await book(paidRoom, promo.MaCode);
    const bookingId = created.body.data.MaDatPhong as number;

    const cancelled = await request(app).post(`/api/bookings/${bookingId}/cancel`).set('Authorization', `Bearer ${customerToken}`).send({});
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data).toMatchObject({ TrangThai: BOOKING_STATUS.CANCELLED, TongTienThanhToan: 0, ThanhToan: [] });
    expect(await refundRows(bookingId)).toBe(0);
    expect(await paymentRows(bookingId)).toBe(0);

    const again = await book(paidRoom, promo.MaCode);
    expect(again.status).toBe(201);
  });
});

describe('bookings with something to pay are unchanged', () => {
  it('a 10% promotion still leaves the booking "Chờ thanh toán" with a payment deadline', async () => {
    const promo = await makePromo({ loaiGiamGia: DISCOUNT_TYPE.PERCENT, giaTriGiam: 10 });
    const res = await book(paidRoom, promo.MaCode);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ TrangThai: BOOKING_STATUS.PENDING_PAYMENT, TongTienThanhToan: 450000 });
    expect(res.body.data.HanThanhToan).toEqual(expect.any(String));
    expect(res.body.data.SoGiayConLai).toBeGreaterThan(0);
  });
});
