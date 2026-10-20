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

// Hôm nay theo múi giờ nghiệp vụ
const addDays = (days: number): Date => new Date(`${addDaysToDateKey(businessToday(), days)}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

const accountIds: number[] = [];
const diaPhuongIds: number[] = [];
const hotelIds: number[] = [];
const promotionIds: number[] = [];

let hotelId: number;
let customerId: number;
let roomA: number;
let roomB: number;
let roomC: number;

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

  // Phòng A đủ giá 10 ngày và tồn kho dồi dào
  for (let i = 0; i < 10; i++) {
    await prisma.qUY_PHONG_GIA.create({
      data: { MaLoaiPhong: roomA, NgayApDung: addDays(i), GiaPhong: 500000, SoLuongPhong: 5, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE },
    });
  }

  // Phòng B có giá 10 ngày nhưng chỉ 2 phòng
  for (let i = 0; i < 10; i++) {
    await prisma.qUY_PHONG_GIA.create({
      data: { MaLoaiPhong: roomB, NgayApDung: addDays(i), GiaPhong: 800000, SoLuongPhong: 2, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE },
    });
  }
  // Đơn xác nhận chiếm hết 2 phòng B
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

  // Phòng C thiếu giá ngày 4
  for (let i = 0; i < 10; i++) {
    if (i === 4) continue;
    await prisma.qUY_PHONG_GIA.create({
      data: { MaLoaiPhong: roomC, NgayApDung: addDays(i), GiaPhong: 600000, SoLuongPhong: 3, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE },
    });
  }
});

afterAll(async () => {
  const prisma = getPrismaClient();
  // Xóa đơn tạo trực tiếp trước khi dọn khách sạn
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
    expect(res.body.data.ChiTietPhong[0].ThanhTien).toBe(1_500_000);
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
          { maLoaiPhong: roomA, soLuong: 2 },
          { maLoaiPhong: roomB, soLuong: 1 },
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
    expect(res1.body.data.ChiTietPhong[0].ThanhTien).toBe(500_000);

    const res2 = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(4)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }] });
    expect(res2.body.data.SoDem).toBe(4);
    expect(res2.body.data.ChiTietPhong[0].ThanhTien).toBe(2_000_000);
  });

  it('flags a room type with a missing QUY_PHONG_GIA day as unpriceable, without crashing the rest of the quote', async () => {
    const res = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({
        checkIn: iso(addDays(3)),
        checkOut: iso(addDays(6)),
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
    expect(line.SoPhongConLai).toBe(0);
    expect(line.DuPhong).toBe(false);
    expect(res.body.data.KhaDung).toBe(false);
    // Vẫn có giá đầy đủ
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
        TongTienThanhToan: 1,
        SoTienGiam: 999999999,
      });
    expect(res.status).toBe(200);
    expect(res.body.data.TongTienThanhToan).toBe(500_000);
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
    expect(res.body.data.SoTienGiam).toBe(100_000);
    expect(res.body.data.TongTienThanhToan).toBe(900_000);
  });

  it('caps a percentage discount at MucGiamToiDa', async () => {
    const promo = await createTestPromotion({ loaiGiamGia: DISCOUNT_TYPE.PERCENT, giaTriGiam: 50, mucGiamToiDa: 100000 });
    promotionIds.push(promo.MaKhuyenMai);

    const res = await request(app)
      .post(`/api/hotels/${hotelId}/quote`)
      .send({ checkIn: iso(addDays(0)), checkOut: iso(addDays(2)), rooms: [{ maLoaiPhong: roomA, soLuong: 1 }], promoCode: promo.MaCode });

    // Giảm 50% nhưng bị giới hạn ở 100.000
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
    expect(res.body.data.TongTienThanhToan).toBe(res.body.data.TongTienPhong);
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

    // Giả lập một đơn chưa hủy đã dùng mã
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

    expect(res.body.data.PromoHopLe).toBe(true);

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
