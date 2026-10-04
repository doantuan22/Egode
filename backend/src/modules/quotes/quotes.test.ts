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
import { DISCOUNT_TYPE } from '../../common/constants/commercial';
import { addDaysToDateKey, businessToday } from '../../common/utils/stay-dates';

// "Today" is the business-time-zone day (Asia/Ho_Chi_Minh) — the same day the API validates stay dates against.
const addDays = (days: number): Date => new Date(`${addDaysToDateKey(businessToday(), days)}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

const accountIds: number[] = [];
const diaPhuongIds: number[] = [];
const hotelIds: number[] = [];
const promotionIds: number[] = [];

let hotelId: number;
let customerId: number;
let roomA: number; // priced every night, plenty of stock
let roomB: number; // will be made sold-out over a specific range
let roomC: number; // deliberately missing a QUY_PHONG_GIA row (unpriced) mid-range

beforeAll(async () => {
  const { account } = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  accountIds.push(account.MaTaiKhoan);
  const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(customer.account.MaTaiKhoan);
  customerId = customer.account.MaTaiKhoan;

  const diaPhuong = await createTestDiaPhuong();
  diaPhuongIds.push(diaPhuong.MaDiaPhuong);
  const hotel = await createTestHotel(account.MaTaiKhoan, diaPhuong.MaDiaPhuong);
  hotelIds.push(hotel.MaKhachSan);
  hotelId = hotel.MaKhachSan;

  const rtA = await createTestRoomType(hotel.MaKhachSan);
  const rtB = await createTestRoomType(hotel.MaKhachSan);
  const rtC = await createTestRoomType(hotel.MaKhachSan);
  roomA = rtA.MaLoaiPhong;
  roomB = rtB.MaLoaiPhong;
  roomC = rtC.MaLoaiPhong;

  const prisma = getPrismaClient();

  // Room A: fully priced for the next 10 days, generous stock (5 rooms).
  for (let i = 0; i < 10; i++) {
    await prisma.qUY_PHONG_GIA.create({
      data: { MaLoaiPhong: roomA, NgayApDung: addDays(i), GiaPhong: 500000, SoLuongPhong: 5, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE },
    });
  }

  // Room B: priced for the next 10 days, only 2 rooms of stock (used for sold-out test).
  for (let i = 0; i < 10; i++) {
    await prisma.qUY_PHONG_GIA.create({
      data: { MaLoaiPhong: roomB, NgayApDung: addDays(i), GiaPhong: 800000, SoLuongPhong: 2, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE },
    });
  }
  // A confirmed booking eats both Room B rooms on day 5-6 (1 night).
  const policy = await prisma.cHINH_SACH_HUY.findFirst();
  const booking = await prisma.dAT_PHONG.create({
    data: {
      MaXacNhanDatPhong: `QUOTE-TEST-${Date.now()}`,
      TAI_KHOAN: { connect: { MaTaiKhoan: customerId } },
      KHACH_SAN: { connect: { MaKhachSan: hotel.MaKhachSan } },
      CHINH_SACH_HUY: { connect: { MaChinhSachHuy: policy!.MaChinhSachHuy } },
      NgayNhanPhong: addDays(5),
      NgayTraPhong: addDays(6),
      TongTienPhong: 1600000,
      SoTienGiam: 0,
      TongTienThanhToan: 1600000,
      TrangThai: BOOKING_STATUS.CONFIRMED,
      NgayTao: new Date(),
      NgayCapNhat: new Date(),
    },
  });
  await prisma.cHI_TIET_DAT_PHONG.create({ data: { MaDatPhong: booking.MaDatPhong, MaLoaiPhong: roomB, SoLuongPhong: 2 } });

  // Room C: priced for days 0-3 and 5-9, but MISSING day 4 entirely (unpriced gap).
  for (let i = 0; i < 10; i++) {
    if (i === 4) continue;
    await prisma.qUY_PHONG_GIA.create({
      data: { MaLoaiPhong: roomC, NgayApDung: addDays(i), GiaPhong: 600000, SoLuongPhong: 3, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE },
    });
  }
});

afterAll(async () => {
  const prisma = getPrismaClient();
  // Delete bookings created directly in this file before the cascading
  // deleteTestHotel cleanup (which does not know about ad-hoc DAT_PHONG rows).
  await prisma.cHI_TIET_DAT_PHONG.deleteMany({ where: { MaLoaiPhong: { in: [roomA, roomB, roomC] } } });
  await prisma.dAT_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });

  await Promise.all(promotionIds.map((id) => deleteTestPromotion(id)));
  await Promise.all(hotelIds.map((id) => deleteTestHotel(id)));
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await Promise.all(diaPhuongIds.map((id) => deleteTestDiaPhuong(id)));
});

describe('POST /api/hotels/:id/quote — room pricing & availability', () => {
  it('quotes correctly across multiple nights', async () => {
    const res = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(3)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }] });

    expect(res.status).toBe(200);
    expect(res.body.data.SoDem).toBe(3);
    expect(res.body.data.ChiTietPhong[0].ThanhTien).toBe(1_500_000); // 500k x 3 nights x 1 room
    expect(res.body.data.TongTienPhong).toBe(1_500_000);
    expect(res.body.data.KhaDung).toBe(true);
  });

  it('quotes multiple room types in one request, summing correctly', async () => {
    const res = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({
        checkIn: iso(addDays(0)),
        checkOut: iso(addDays(2)),
        rooms: [
          { maLoaiPhong: roomA, soLuong: 2 }, // 500k * 2 nights * 2 rooms = 2,000,000
          { maLoaiPhong: roomB, soLuong: 1 }, // 800k * 2 nights * 1 room = 1,600,000
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.ChiTietPhong).toHaveLength(2);
    expect(res.body.data.TongTienPhong).toBe(3_600_000);
  });

  it('does not count the checkout date as an extra night', async () => {
    const res1 = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(1)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }] });
    expect(res1.body.data.SoDem).toBe(1);
    expect(res1.body.data.ChiTietPhong[0].ThanhTien).toBe(500_000); // exactly 1 night, not 2

    const res2 = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(4)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }] });
    expect(res2.body.data.SoDem).toBe(4);
    expect(res2.body.data.ChiTietPhong[0].ThanhTien).toBe(2_000_000); // 4 nights, checkout day excluded
  });

  it('flags a room type with a missing QUY_PHONG_GIA day as unpriceable, without crashing the rest of the quote', async () => {
    const res = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({
        checkIn: iso(addDays(3)),
        checkOut: iso(addDays(6)), // spans the missing day 4 for roomC
        rooms: [{ maLoaiPhong: roomC, soLuong: 1 }],
      });

    expect(res.status).toBe(200);
    const line = res.body.data.ChiTietPhong[0];
    expect(line.CoGiaDayDu).toBe(false);
    expect(line.ThanhTien).toBeNull();
    expect(res.body.data.KhaDung).toBe(false);
  });

  it('flags a sold-out room type (insufficient inventory) without crashing the quote', async () => {
    const res = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({ checkIn: iso(addDays(5)), checkOut: iso(addDays(6)), rooms: [{ maLoaiPhong: roomB, soLuong: 1 }] });

    expect(res.status).toBe(200);
    const line = res.body.data.ChiTietPhong[0];
    expect(line.SoPhongConLai).toBe(0); // both rooms taken by the seeded booking
    expect(line.DuPhong).toBe(false);
    expect(res.body.data.KhaDung).toBe(false);
    // Still priced (CoGiaDayDu true) — sold-out and unpriced are distinct states.
    expect(line.CoGiaDayDu).toBe(true);
  });

  it('rejects a room type id that does not belong to this hotel', async () => {
    const res = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(1)), rooms: [{ maLoaiPhong: 999999999, soLuong: 1 }] });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid date range', async () => {
    const res = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({ checkIn: iso(addDays(5)), checkOut: iso(addDays(5)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }] });
    expect(res.status).toBe(400);
  });

  it('the client cannot override the computed total by sending one', async () => {
    const res = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({
        checkIn: iso(addDays(0)),
        checkOut: iso(addDays(1)),
        rooms: [{ maLoaiPhong: roomA, soLuong: 1 }],
        TongTienThanhToan: 1, // attacker-supplied — must be silently ignored
        SoTienGiam: 999999999,
      });
    expect(res.status).toBe(200);
    expect(res.body.data.TongTienThanhToan).toBe(500_000); // server-computed, not 1
    expect(res.body.data.SoTienGiam).toBe(0);
  });

  it('returns the applicable system-wide cancellation policy', async () => {
    const res = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(1)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }] });
    expect(res.status).toBe(200);
    expect(res.body.data.ChinhSachHuy).not.toBeNull();
    expect(Array.isArray(res.body.data.ChinhSachHuy.ChiTiet)).toBe(true);
  });
});

describe('POST /api/hotels/:id/quote — promotions', () => {
  it('applies a valid percentage promo', async () => {
    const promo = await createTestPromotion({ loaiGiamGia: DISCOUNT_TYPE.PERCENT, giaTriGiam: 10 });
    promotionIds.push(promo.MaKhuyenMai);

    const res = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(2)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }], promoCode: promo.MaCode });

    expect(res.status).toBe(200);
    expect(res.body.data.PromoHopLe).toBe(true);
    expect(res.body.data.TongTienPhong).toBe(1_000_000);
    expect(res.body.data.SoTienGiam).toBe(100_000); // 10%
    expect(res.body.data.TongTienThanhToan).toBe(900_000);
  });

  it('caps a percentage discount at MucGiamToiDa', async () => {
    const promo = await createTestPromotion({ loaiGiamGia: DISCOUNT_TYPE.PERCENT, giaTriGiam: 50, mucGiamToiDa: 100000 });
    promotionIds.push(promo.MaKhuyenMai);

    const res = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(2)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }], promoCode: promo.MaCode });

    // Subtotal 1,000,000 * 50% = 500,000, but capped at 100,000.
    expect(res.body.data.SoTienGiam).toBe(100_000);
    expect(res.body.data.TongTienThanhToan).toBe(900_000);
  });

  it('applies a fixed-amount discount', async () => {
    const promo = await createTestPromotion({ loaiGiamGia: DISCOUNT_TYPE.FIXED_AMOUNT, giaTriGiam: 150000 });
    promotionIds.push(promo.MaKhuyenMai);

    const res = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(2)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }], promoCode: promo.MaCode });

    expect(res.body.data.SoTienGiam).toBe(150_000);
    expect(res.body.data.TongTienThanhToan).toBe(850_000);
  });

  it('rejects a promo that has not started yet (still returns room pricing)', async () => {
    const promo = await createTestPromotion({ ngayBatDau: addDays(30), ngayKetThuc: addDays(60) });
    promotionIds.push(promo.MaKhuyenMai);

    const res = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(2)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }], promoCode: promo.MaCode });

    expect(res.status).toBe(200);
    expect(res.body.data.PromoHopLe).toBe(false);
    expect(res.body.data.PromoThongBao).toMatch(/chưa bắt đầu/i);
    expect(res.body.data.SoTienGiam).toBe(0);
    expect(res.body.data.TongTienThanhToan).toBe(res.body.data.TongTienPhong); // no discount applied
  });

  it('rejects an expired promo', async () => {
    const promo = await createTestPromotion({ ngayBatDau: addDays(-60), ngayKetThuc: addDays(-1) });
    promotionIds.push(promo.MaKhuyenMai);

    const res = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(2)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }], promoCode: promo.MaCode });

    expect(res.body.data.PromoHopLe).toBe(false);
    expect(res.body.data.PromoThongBao).toMatch(/hết hạn/i);
  });

  it('rejects a promo when the order total is below the minimum', async () => {
    const promo = await createTestPromotion({ giaTriDonToiThieu: 5_000_000 });
    promotionIds.push(promo.MaKhuyenMai);

    const res = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(2)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }], promoCode: promo.MaCode });

    expect(res.body.data.PromoHopLe).toBe(false);
    expect(res.body.data.PromoThongBao).toMatch(/giá trị tối thiểu/i);
  });

  it('rejects an invalid/unknown promo code, still returning room pricing', async () => {
    const res = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(2)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }], promoCode: 'DOES_NOT_EXIST_XYZ' });

    expect(res.status).toBe(200);
    expect(res.body.data.PromoHopLe).toBe(false);
    expect(res.body.data.PromoThongBao).toMatch(/không tồn tại/i);
    expect(res.body.data.TongTienThanhToan).toBe(res.body.data.TongTienPhong);
  });

  it('rejects a promo once its usage limit is reached', async () => {
    const promo = await createTestPromotion({ soLuongGioiHan: 1 });
    promotionIds.push(promo.MaKhuyenMai);
    const prisma = getPrismaClient();
    const policy = await prisma.cHINH_SACH_HUY.findFirst();

    // Simulate 1 prior (non-cancelled) booking already used this code.
    const booking = await prisma.dAT_PHONG.create({
      data: {
        MaXacNhanDatPhong: `QUOTE-PROMO-USED-${Date.now()}`,
        TAI_KHOAN: { connect: { MaTaiKhoan: customerId } },
        KHACH_SAN: { connect: { MaKhachSan: hotelId } },
        CHINH_SACH_HUY: { connect: { MaChinhSachHuy: policy!.MaChinhSachHuy } },
        KHUYEN_MAI: { connect: { MaKhuyenMai: promo.MaKhuyenMai } },
        NgayNhanPhong: addDays(0),
        NgayTraPhong: addDays(1),
        TongTienPhong: 500000,
        SoTienGiam: 50000,
        TongTienThanhToan: 450000,
        TrangThai: BOOKING_STATUS.CONFIRMED,
        NgayTao: new Date(),
        NgayCapNhat: new Date(),
      },
    });

    const res = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(2)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }], promoCode: promo.MaCode });

    expect(res.body.data.PromoHopLe).toBe(false);
    expect(res.body.data.PromoThongBao).toMatch(/hết lượt/i);

    await prisma.dAT_PHONG.delete({ where: { MaDatPhong: booking.MaDatPhong } });
  });

  it('does not count a cancelled booking against the usage limit', async () => {
    const promo = await createTestPromotion({ soLuongGioiHan: 1 });
    promotionIds.push(promo.MaKhuyenMai);
    const prisma = getPrismaClient();
    const policy = await prisma.cHINH_SACH_HUY.findFirst();

    const booking = await prisma.dAT_PHONG.create({
      data: {
        MaXacNhanDatPhong: `QUOTE-PROMO-CANCELLED-${Date.now()}`,
        TAI_KHOAN: { connect: { MaTaiKhoan: customerId } },
        KHACH_SAN: { connect: { MaKhachSan: hotelId } },
        CHINH_SACH_HUY: { connect: { MaChinhSachHuy: policy!.MaChinhSachHuy } },
        KHUYEN_MAI: { connect: { MaKhuyenMai: promo.MaKhuyenMai } },
        NgayNhanPhong: addDays(0),
        NgayTraPhong: addDays(1),
        TongTienPhong: 500000,
        SoTienGiam: 50000,
        TongTienThanhToan: 450000,
        TrangThai: BOOKING_STATUS.CANCELLED,
        NgayTao: new Date(),
        NgayCapNhat: new Date(),
      },
    });

    const res = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(2)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }], promoCode: promo.MaCode });

    expect(res.body.data.PromoHopLe).toBe(true); // still usable — the cancelled booking doesn't count

    await prisma.dAT_PHONG.delete({ where: { MaDatPhong: booking.MaDatPhong } });
  });

  it('rejects an inactive promo', async () => {
    const promo = await createTestPromotion({ trangThai: 'Ngừng' });
    promotionIds.push(promo.MaKhuyenMai);

    const res = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(2)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }], promoCode: promo.MaCode });

    expect(res.body.data.PromoHopLe).toBe(false);
  });
});
