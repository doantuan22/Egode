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
import { BOOKING_STATUS, HOTEL_STATUS, ROOM_RATE_STATUS, ROOM_TYPE_STATUS } from '../../common/constants/hotel-status';
import { addDaysToDateKey, businessToday } from '../../common/utils/stay-dates';

/** Chủ khách sạn không thể giảm giá phòng dưới số đã đặt */
const day = (n: number) => addDaysToDateKey(businessToday(), n);
const at = (n: number) => new Date(`${day(n)}T00:00:00Z`);
const prisma = () => getPrismaClient();

const accountIds: number[] = [];
let diaPhuongId = 0;
let hotelId = 0;
let policyId = 0;
let ownerId = 0;
let ownerToken = '';
let customerId = 0;
let customerToken = '';
const login = async (email: string, password: string) =>
  (await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password })).body.data.accessToken as string;

beforeAll(async () => {
  const owner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(owner.account.MaTaiKhoan, customer.account.MaTaiKhoan);
  ownerId = owner.account.MaTaiKhoan;
  customerId = customer.account.MaTaiKhoan;
  ownerToken = await login(owner.account.Email, owner.plainPassword);
  customerToken = await login(customer.account.Email, customer.plainPassword);
  diaPhuongId = (await createTestDiaPhuong()).MaDiaPhuong;
  hotelId = (await createTestHotel(ownerId, diaPhuongId)).MaKhachSan;
  policyId = (await createTestCancellationPolicy([{ soGioTruocNhanPhong: 24, tyLeHoanTien: 100 }])).MaChinhSachHuy;
});

afterAll(async () => {
  await prisma().hOAN_TIEN.deleteMany({ where: { THANH_TOAN: { DAT_PHONG: { MaKhachSan: hotelId } } } });
  await prisma().tHANH_TOAN.deleteMany({ where: { DAT_PHONG: { MaKhachSan: hotelId } } });
  await prisma().cHI_TIET_DAT_PHONG.deleteMany({ where: { DAT_PHONG: { MaKhachSan: hotelId } } });
  await prisma().dAT_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });
  await deleteTestCancellationPolicy(policyId);
  await deleteTestHotel(hotelId);
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await deleteTestDiaPhuong(diaPhuongId);
});

/** Loại phòng bán trong 5 ngày */
const roomTypeWithStock = async (stock = 5) => {
  const roomType = await createTestRoomType(hotelId);
  for (let d = 1; d <= 5; d++) {
    await prisma().qUY_PHONG_GIA.create({
      data: { MaLoaiPhong: roomType.MaLoaiPhong, NgayApDung: at(d), GiaPhong: 500000, SoLuongPhong: stock, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE },
    });
  }
  return roomType.MaLoaiPhong;
};

/** Phòng bị chiếm từ ngày nhận đến ngày trả */
const occupy = async (roomTypeId: number, rooms: number, fromDay: number, toDay: number, trangThai: string = BOOKING_STATUS.CONFIRMED, ngayTao?: Date) => {
  const booking = await createTestBookingDirect(customerId, hotelId, policyId, at(fromDay), at(toDay), { trangThai, ngayTao });
  await prisma().cHI_TIET_DAT_PHONG.create({ data: { MaDatPhong: booking.MaDatPhong, MaLoaiPhong: roomTypeId, SoLuongPhong: rooms } });
  return booking.MaDatPhong;
};

const putRates = (roomTypeId: number, rates: Array<{ d: number; qty: number; price?: number; status?: string }>, token = ownerToken) =>
  request(app)
    .put(`/api/owner/room-types/${roomTypeId}/rates`)
    .set('Authorization', `Bearer ${token}`)
    .send({ rates: rates.map((r) => ({ NgayApDung: day(r.d), GiaPhong: r.price ?? 500000, SoLuongPhong: r.qty, TrangThai: r.status ?? ROOM_RATE_STATUS.OPEN_FOR_SALE })) });
const stockOn = async (roomTypeId: number, d: number) =>
  (await prisma().qUY_PHONG_GIA.findUniqueOrThrow({ where: { MaLoaiPhong_NgayApDung: { MaLoaiPhong: roomTypeId, NgayApDung: at(d) } } }));

describe('SoLuongPhong can never drop below the rooms already booked for that night', () => {
  it('multi-day update where every night stays >= its booked count is accepted (including nights with no booking)', async () => {
    const rt = await roomTypeWithStock(5);
    await occupy(rt, 3, 2, 4);
    await occupy(rt, 1, 3, 4, BOOKING_STATUS.PENDING_PAYMENT, new Date());
    await occupy(rt, 5, 2, 3, BOOKING_STATUS.CANCELLED);

    const res = await putRates(rt, [
      { d: 1, qty: 0 },
      { d: 2, qty: 3 },
      { d: 3, qty: 4 },
      { d: 4, qty: 1 },
      { d: 5, qty: 2, price: 650000 },
    ]);

    expect(res.status).toBe(200);
    expect((await stockOn(rt, 1)).SoLuongPhong).toBe(0);
    expect((await stockOn(rt, 3)).SoLuongPhong).toBe(4);
    expect(Number((await stockOn(rt, 5)).GiaPhong)).toBe(650000);
  });

  it('one night below its booked count rejects the whole request with 409 and saves none of it', async () => {
    const rt = await roomTypeWithStock(5);
    await occupy(rt, 3, 2, 4);

    const res = await putRates(rt, [
      { d: 1, qty: 1, price: 111111 },
      { d: 2, qty: 2 },
      { d: 3, qty: 2 },
      { d: 5, qty: 1, price: 222222 },
    ]);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain(day(2));
    expect(res.body.message).toMatch(/3 phòng/);
    expect(res.body.details).toHaveLength(2);
    expect((await stockOn(rt, 1)).SoLuongPhong).toBe(5);
    expect(Number((await stockOn(rt, 1)).GiaPhong)).toBe(500000);
    expect(Number((await stockOn(rt, 5)).GiaPhong)).toBe(500000);
  });

  it('an unpaid hold past the payment timeout no longer blocks a reduction', async () => {
    const rt = await roomTypeWithStock(5);
    await occupy(rt, 4, 2, 3, BOOKING_STATUS.PENDING_PAYMENT, new Date(Date.now() - 60 * 60_000));
    expect((await putRates(rt, [{ d: 2, qty: 1 }])).status).toBe(200);
  });

  it('closing a night to sale keeps the existing booking and needs no reduction', async () => {
    const rt = await roomTypeWithStock(5);
    const bookingId = await occupy(rt, 3, 2, 3);

    const res = await putRates(rt, [{ d: 2, qty: 3, status: ROOM_RATE_STATUS.CLOSED }]);

    expect(res.status).toBe(200);
    expect((await stockOn(rt, 2)).TrangThai).toBe(ROOM_RATE_STATUS.CLOSED);
    expect((await prisma().dAT_PHONG.findUniqueOrThrow({ where: { MaDatPhong: bookingId } })).TrangThai).toBe(BOOKING_STATUS.CONFIRMED);
    expect((await putRates(rt, [{ d: 2, qty: 1, status: ROOM_RATE_STATUS.CLOSED }])).status).toBe(409);
  });
});

describe('past nights are read-only', () => {
  it('a past date is refused with 400 and the rest of the request is not applied', async () => {
    const rt = await roomTypeWithStock(5);
    await prisma().qUY_PHONG_GIA.create({ data: { MaLoaiPhong: rt, NgayApDung: at(-2), GiaPhong: 400000, SoLuongPhong: 2, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE } });

    const res = await putRates(rt, [{ d: -2, qty: 9 }, { d: 1, qty: 1, price: 333333 }]);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain(day(-2));
    expect((await stockOn(rt, -2)).SoLuongPhong).toBe(2);
    expect(Number((await stockOn(rt, 1)).GiaPhong)).toBe(500000);
  });

  it('today itself is still editable', async () => {
    const rt = await roomTypeWithStock(5);
    expect((await putRates(rt, [{ d: 0, qty: 3 }])).status).toBe(200);
  });
});

describe('a suspended hotel cannot change inventory or price', () => {
  it('rates are refused with 403, and the profile only accepts name / address / description', async () => {
    const owner2 = await createTestAccount({ role: ROLE_NAMES.PARTNER });
    accountIds.push(owner2.account.MaTaiKhoan);
    const token2 = await login(owner2.account.Email, owner2.plainPassword);
    const hotel = await createTestHotel(owner2.account.MaTaiKhoan, diaPhuongId);
    const rt = (await createTestRoomType(hotel.MaKhachSan)).MaLoaiPhong;
    await prisma().qUY_PHONG_GIA.create({ data: { MaLoaiPhong: rt, NgayApDung: at(1), GiaPhong: 500000, SoLuongPhong: 5, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE } });
    await prisma().kHACH_SAN.update({ where: { MaKhachSan: hotel.MaKhachSan }, data: { TrangThai: HOTEL_STATUS.SUSPENDED } });

    const rates = await putRates(rt, [{ d: 1, qty: 9, price: 1 }], token2);
    expect(rates.status).toBe(403);
    expect((await stockOn(rt, 1)).SoLuongPhong).toBe(5);

    const patch = (body: object) => request(app).patch(`/api/owner/hotels/${hotel.MaKhachSan}`).set('Authorization', `Bearer ${token2}`).send(body);
    expect((await patch({ MoTa: 'Đã khắc phục vi phạm', TenKhachSan: 'Tên mới sau đình chỉ' })).status).toBe(200);
    const refused = await patch({ HangSao: 5, GioNhanPhong: '10:00' });
    expect(refused.status).toBe(403);
    expect(refused.body.message).toMatch(/HangSao/);
    const row = await prisma().kHACH_SAN.findUniqueOrThrow({ where: { MaKhachSan: hotel.MaKhachSan } });
    expect(row.HangSao).toBe(3);
    expect(row.MoTa).toBe('Đã khắc phục vi phạm');

    await prisma().cHI_TIET_DAT_PHONG.deleteMany({ where: { DAT_PHONG: { MaKhachSan: hotel.MaKhachSan } } });
    await deleteTestHotel(hotel.MaKhachSan);
  });

  it('an active hotel can still edit every profile field (the restriction is for suspension only)', async () => {
    const res = await request(app).patch(`/api/owner/hotels/${hotelId}`).set('Authorization', `Bearer ${ownerToken}`).send({ HangSao: 4, MoTa: 'ok' });
    expect(res.status).toBe(200);
  });
});

describe('switching a hotel or room type off only stops NEW bookings (a hotel only while it has no open booking)', () => {
  const book = (roomTypeId: number) =>
    request(app).post(`/api/hotels/${hotelId}/bookings`).set('Authorization', `Bearer ${customerToken}`).send({ checkIn: day(3), checkOut: day(4), rooms: [{ maLoaiPhong: roomTypeId, soLuong: 1 }] });

  /** Mỗi ca dùng khách sạn riêng */
  const withOwnHotel = async (run: (h: { id: number; roomTypeId: number; occupy: (rooms: number, from: number, to: number, status: string) => Promise<number> }) => Promise<void>) => {
    const id = (await createTestHotel(ownerId, diaPhuongId)).MaKhachSan;
    const roomType = await createTestRoomType(id);
    for (let d = 1; d <= 5; d++) {
      await prisma().qUY_PHONG_GIA.create({ data: { MaLoaiPhong: roomType.MaLoaiPhong, NgayApDung: at(d), GiaPhong: 500000, SoLuongPhong: 5, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE } });
    }
    const occupyHere = async (rooms: number, from: number, to: number, status: string) => {
      const booking = await createTestBookingDirect(customerId, id, policyId, at(from), at(to), { trangThai: status });
      await prisma().cHI_TIET_DAT_PHONG.create({ data: { MaDatPhong: booking.MaDatPhong, MaLoaiPhong: roomType.MaLoaiPhong, SoLuongPhong: rooms } });
      return booking.MaDatPhong;
    };
    try {
      await run({ id, roomTypeId: roomType.MaLoaiPhong, occupy: occupyHere });
    } finally {
      await prisma().hOAN_TIEN.deleteMany({ where: { THANH_TOAN: { DAT_PHONG: { MaKhachSan: id } } } });
      await prisma().tHANH_TOAN.deleteMany({ where: { DAT_PHONG: { MaKhachSan: id } } });
      await prisma().cHI_TIET_DAT_PHONG.deleteMany({ where: { DAT_PHONG: { MaKhachSan: id } } });
      await prisma().dAT_PHONG.deleteMany({ where: { MaKhachSan: id } });
      await deleteTestHotel(id);
    }
  };
  const call = (path: string, token = ownerToken) => request(app).post(path).set('Authorization', `Bearer ${token}`).send({});
  const statusOf = async (id: number) => (await prisma().kHACH_SAN.findUniqueOrThrow({ where: { MaKhachSan: id } })).TrangThai;

  it('refuses to deactivate the hotel while it has a confirmed booking, then allows it once that booking is cancelled', async () => {
    await withOwnHotel(async (h) => {
      const bookingId = await h.occupy(1, 2, 4, BOOKING_STATUS.CONFIRMED);

      const refused = await call(`/api/owner/hotels/${h.id}/deactivate`);
      expect(refused.status).toBe(409);
      expect(refused.body.message).toMatch(/chưa hoàn tất/);
      expect(await statusOf(h.id)).toBe(HOTEL_STATUS.ACTIVE);
      expect((await prisma().dAT_PHONG.findUniqueOrThrow({ where: { MaDatPhong: bookingId } })).TrangThai).toBe(BOOKING_STATUS.CONFIRMED);

      expect((await call(`/api/bookings/${bookingId}/cancel`, customerToken)).status).toBe(200);

      expect((await call(`/api/owner/hotels/${h.id}/deactivate`)).status).toBe(200);
      expect(await statusOf(h.id)).toBe(HOTEL_STATUS.INACTIVE);
      const newBooking = await request(app)
        .post(`/api/hotels/${h.id}/bookings`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ checkIn: day(3), checkOut: day(4), rooms: [{ maLoaiPhong: h.roomTypeId, soLuong: 1 }] });
      expect(newBooking.status).toBe(404);
    });
  });

  it('a booking still waiting for payment also blocks it, but one whose payment deadline has passed does not', async () => {
    await withOwnHotel(async (h) => {
      const waiting = await h.occupy(1, 2, 3, BOOKING_STATUS.PENDING_PAYMENT);

      expect((await call(`/api/owner/hotels/${h.id}/deactivate`)).status).toBe(409);
      expect(await statusOf(h.id)).toBe(HOTEL_STATUS.ACTIVE);

      await prisma().dAT_PHONG.update({ where: { MaDatPhong: waiting }, data: { NgayTao: new Date(Date.now() - 24 * 60 * 60 * 1000) } });

      expect((await call(`/api/owner/hotels/${h.id}/deactivate`)).status).toBe(200);
      expect((await prisma().dAT_PHONG.findUniqueOrThrow({ where: { MaDatPhong: waiting } })).TrangThai).toBe(BOOKING_STATUS.CANCELLED);
    });
  });

  it('cancelled and completed bookings do not block it', async () => {
    await withOwnHotel(async (h) => {
      await h.occupy(1, 2, 3, BOOKING_STATUS.CANCELLED);
      await h.occupy(1, 3, 4, BOOKING_STATUS.COMPLETED);

      expect((await call(`/api/owner/hotels/${h.id}/deactivate`)).status).toBe(200);
      expect(await statusOf(h.id)).toBe(HOTEL_STATUS.INACTIVE);
    });
  });

  it('refuses to stop selling a room type that is in an open booking, then allows it once that booking is cancelled; new bookings are refused afterwards', async () => {
    const rt = await roomTypeWithStock(5);
    const bookingId = await occupy(rt, 2, 2, 4);
    const status = async () => (await prisma().lOAI_PHONG.findUniqueOrThrow({ where: { MaLoaiPhong: rt } })).TrangThai;

    const refused = await request(app).post(`/api/owner/room-types/${rt}/deactivate`).set('Authorization', `Bearer ${ownerToken}`);
    expect(refused.status).toBe(409);
    expect(refused.body.message).toMatch(/chưa hoàn tất/);
    expect(await status()).toBe(ROOM_TYPE_STATUS.ACTIVE);
    expect((await prisma().dAT_PHONG.findUniqueOrThrow({ where: { MaDatPhong: bookingId } })).TrangThai).toBe(BOOKING_STATUS.CONFIRMED);

    const cancel = await request(app).post(`/api/bookings/${bookingId}/cancel`).set('Authorization', `Bearer ${customerToken}`).send({});
    expect(cancel.status).toBe(200);

    const off = await request(app).post(`/api/owner/room-types/${rt}/deactivate`).set('Authorization', `Bearer ${ownerToken}`);
    expect(off.status).toBe(200);
    expect(await status()).toBe(ROOM_TYPE_STATUS.DISCONTINUED);
    expect((await book(rt)).status).toBe(400);
  });
});

describe('a booking and a reduction racing for the same night cannot leave it overbooked', () => {
  it('whichever wins, the final stock is never below the rooms booked (4 rounds)', async () => {
    for (let round = 0; round < 4; round++) {
      const rt = await roomTypeWithStock(4);
      await occupy(rt, 1, 3, 4);
      const bookOne = () =>
        request(app).post(`/api/hotels/${hotelId}/bookings`).set('Authorization', `Bearer ${customerToken}`).send({ checkIn: day(3), checkOut: day(4), rooms: [{ maLoaiPhong: rt, soLuong: 1 }] });

      const results = await Promise.all([bookOne(), bookOne(), bookOne(), bookOne(), putRates(rt, [{ d: 3, qty: 2 }]), bookOne(), bookOne()]);

      const update = results[4];
      expect([200, 409]).toContain(update.status);
      const finalStock = (await stockOn(rt, 3)).SoLuongPhong;
      const booked = await prisma().cHI_TIET_DAT_PHONG.aggregate({
        where: { MaLoaiPhong: rt, DAT_PHONG: { TrangThai: { not: BOOKING_STATUS.CANCELLED }, NgayNhanPhong: at(3) } },
        _sum: { SoLuongPhong: true },
      });
      expect(finalStock).toBeGreaterThanOrEqual(booked._sum.SoLuongPhong ?? 0);
      if (update.status === 200) expect(finalStock).toBe(2);
      if (update.status === 409) expect(finalStock).toBe(4);
    }
  });
});
