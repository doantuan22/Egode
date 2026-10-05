import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
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
import { env } from '../../config/env';
import { ROLE_NAMES } from '../../common/constants/roles';
import { BOOKING_STATUS, ROOM_RATE_STATUS } from '../../common/constants/hotel-status';
import { addDaysToDateKey, businessToday } from '../../common/utils/stay-dates';

/**
 * Bug #5 — an unpaid "Chờ thanh toán" booking older than PAYMENT_TIMEOUT_MINUTES no longer holds a room, and
 * every surface that depends on availability (search, rooms, quote, booking) or on booking statuses (analytics)
 * applies that same rule: they all agree, right before and right after the timeout.
 */
const TTL = env.PAYMENT_TIMEOUT_MINUTES; // 15 by default
const day = (n: number) => addDaysToDateKey(businessToday(), n);
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

const accountIds: number[] = [];
let diaPhuongId = 0;
let cityName = '';
let hotelId = 0;
let policyId = 0;
let customerId = 0;
let customerToken = '';
let ownerToken = '';
let adminToken = '';
const prisma = () => getPrismaClient();
const login = async (email: string, password: string) =>
  (await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password })).body.data.accessToken as string;

beforeAll(async () => {
  const [owner, customer, admin] = await Promise.all([
    createTestAccount({ role: ROLE_NAMES.PARTNER }),
    createTestAccount({ role: ROLE_NAMES.CUSTOMER }),
    createTestAccount({ role: ROLE_NAMES.ADMIN }),
  ]);
  accountIds.push(owner.account.MaTaiKhoan, customer.account.MaTaiKhoan, admin.account.MaTaiKhoan);
  customerId = customer.account.MaTaiKhoan;
  [ownerToken, customerToken, adminToken] = await Promise.all([
    login(owner.account.Email, owner.plainPassword),
    login(customer.account.Email, customer.plainPassword),
    login(admin.account.Email, admin.plainPassword),
  ]);
  const dp = await createTestDiaPhuong();
  diaPhuongId = dp.MaDiaPhuong;
  cityName = dp.TenThanhPho;
  hotelId = (await createTestHotel(owner.account.MaTaiKhoan, diaPhuongId)).MaKhachSan;
  policyId = (await createTestCancellationPolicy([{ soGioTruocNhanPhong: 24, tyLeHoanTien: 100 }])).MaChinhSachHuy;
});

// Each test starts from an empty hotel: leftovers of another test (a fresh hold, another room type) would change the answers.
beforeEach(async () => {
  await prisma().cHI_TIET_DAT_PHONG.deleteMany({ where: { DAT_PHONG: { MaKhachSan: hotelId } } });
  await prisma().dAT_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });
  await prisma().qUY_PHONG_GIA.deleteMany({ where: { LOAI_PHONG: { MaKhachSan: hotelId } } });
  await prisma().lOAI_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });
});

afterAll(async () => {
  await prisma().cHI_TIET_DAT_PHONG.deleteMany({ where: { DAT_PHONG: { MaKhachSan: hotelId } } });
  await prisma().dAT_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });
  await deleteTestCancellationPolicy(policyId);
  await deleteTestHotel(hotelId);
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await deleteTestDiaPhuong(diaPhuongId);
});

/** A room type with exactly ONE room, on sale for day+1, completely taken by an unpaid hold created `age` minutes ago. */
const heldLastRoom = async (ageMinutes: number) => {
  const roomType = await createTestRoomType(hotelId);
  await prisma().qUY_PHONG_GIA.create({
    data: { MaLoaiPhong: roomType.MaLoaiPhong, NgayApDung: new Date(`${day(1)}T00:00:00Z`), GiaPhong: 500000, SoLuongPhong: 1, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE },
  });
  const hold = await createTestBookingDirect(customerId, hotelId, policyId, new Date(`${day(1)}T00:00:00Z`), new Date(`${day(2)}T00:00:00Z`), {
    trangThai: BOOKING_STATUS.PENDING_PAYMENT,
    ngayTao: minutesAgo(ageMinutes),
  });
  await prisma().cHI_TIET_DAT_PHONG.create({ data: { MaDatPhong: hold.MaDatPhong, MaLoaiPhong: roomType.MaLoaiPhong, SoLuongPhong: 1 } });
  return { roomTypeId: roomType.MaLoaiPhong, holdId: hold.MaDatPhong };
};

const search = async () => {
  const res = await request(app).get('/api/hotels').query({ location: cityName, checkIn: day(1), checkOut: day(2), guests: 1 });
  expect(res.status).toBe(200);
  return res.body.data.find((h: { MaKhachSan: number }) => h.MaKhachSan === hotelId) as { ConPhong: boolean } | undefined;
};
const rooms = async (roomTypeId: number) => {
  const res = await request(app).get(`/api/hotels/${hotelId}/rooms`).query({ checkIn: day(1), checkOut: day(2) });
  expect(res.status).toBe(200);
  return res.body.data.find((r: { MaLoaiPhong: number }) => r.MaLoaiPhong === roomTypeId) as { SoPhongConLai: number; ConHang: boolean };
};
const quote = async (roomTypeId: number) => {
  const res = await request(app).post(`/api/hotels/${hotelId}/quote`).send({ checkIn: day(1), checkOut: day(2), rooms: [{ maLoaiPhong: roomTypeId, soLuong: 1 }] });
  expect(res.status).toBe(200);
  return res.body.data as { KhaDung: boolean; ChiTietPhong: Array<{ SoPhongConLai: number }> };
};
const book = (roomTypeId: number) =>
  request(app).post(`/api/hotels/${hotelId}/bookings`).set('Authorization', `Bearer ${customerToken}`).send({ checkIn: day(1), checkOut: day(2), rooms: [{ maLoaiPhong: roomTypeId, soLuong: 1 }] });
const status = async (id: number) => (await prisma().dAT_PHONG.findUniqueOrThrow({ where: { MaDatPhong: id } })).TrangThai;
const ownerPending = async () => {
  const res = await request(app).get(`/api/owner/hotels/${hotelId}/analytics`).set('Authorization', `Bearer ${ownerToken}`);
  expect(res.status).toBe(200);
  return (res.body.data.BookingTheoTrangThai as Array<{ TrangThai: string; SoLuong: number }>).find((s) => s.TrangThai === BOOKING_STATUS.PENDING_PAYMENT)?.SoLuong ?? 0;
};

describe(`just inside the ${TTL}-minute timeout, the hold still occupies the room — on every surface`, () => {
  const inside = TTL - 1;

  it('search, rooms, quote and booking all say "no room left"', async () => {
    const { roomTypeId, holdId } = await heldLastRoom(inside);

    expect((await search())!.ConPhong).toBe(false);
    expect(await rooms(roomTypeId)).toMatchObject({ SoPhongConLai: 0, ConHang: false });
    const q = await quote(roomTypeId);
    expect(q.KhaDung).toBe(false);
    expect(q.ChiTietPhong[0].SoPhongConLai).toBe(0);
    expect((await book(roomTypeId)).status).toBe(409);
    expect(await status(holdId)).toBe(BOOKING_STATUS.PENDING_PAYMENT); // nothing was swept
  });

  it('analytics still counts it as waiting for payment', async () => {
    await heldLastRoom(inside);
    expect(await ownerPending()).toBeGreaterThanOrEqual(1);
  });
});

describe(`just past the ${TTL}-minute timeout, the hold no longer occupies the room — on every surface`, () => {
  const past = TTL + 1;

  it('search sees the room again and the stale hold is released', async () => {
    const { holdId } = await heldLastRoom(past);
    expect((await search())!.ConPhong).toBe(true);
    expect(await status(holdId)).toBe(BOOKING_STATUS.CANCELLED);
  });

  it('rooms lists the room as available again', async () => {
    const { roomTypeId, holdId } = await heldLastRoom(past);
    expect(await rooms(roomTypeId)).toMatchObject({ SoPhongConLai: 1, ConHang: true });
    expect(await status(holdId)).toBe(BOOKING_STATUS.CANCELLED);
  });

  it('quote says it is available (and so does the booking that follows it: they agree)', async () => {
    const { roomTypeId, holdId } = await heldLastRoom(past);
    const q = await quote(roomTypeId);
    expect(q.KhaDung).toBe(true);
    expect(q.ChiTietPhong[0].SoPhongConLai).toBe(1);
    expect(await status(holdId)).toBe(BOOKING_STATUS.CANCELLED);
    expect((await book(roomTypeId)).status).toBe(201);
  });

  it('owner and admin analytics no longer report the stale hold as "Chờ thanh toán"', async () => {
    const { holdId } = await heldLastRoom(past);
    expect(await ownerPending()).toBe(0);
    expect(await status(holdId)).toBe(BOOKING_STATUS.CANCELLED);

    const second = await heldLastRoom(past);
    const admin = await request(app).get('/api/admin/analytics').set('Authorization', `Bearer ${adminToken}`);
    expect(admin.status).toBe(200);
    expect(await status(second.holdId)).toBe(BOOKING_STATUS.CANCELLED);
    const stalePendingLeft = await prisma().dAT_PHONG.count({ where: { TrangThai: BOOKING_STATUS.PENDING_PAYMENT, NgayTao: { lt: minutesAgo(TTL) } } });
    expect(stalePendingLeft).toBe(0);
  });
});

describe('the same rule across surfaces, one scenario', () => {
  it('before: all four agree "full"; after the timeout: all four agree "free"', async () => {
    const { roomTypeId, holdId } = await heldLastRoom(TTL - 1);
    const before = [(await search())!.ConPhong, (await rooms(roomTypeId)).ConHang, (await quote(roomTypeId)).KhaDung];
    expect(before).toEqual([false, false, false]);

    // Time passes: the hold turns 16 minutes old.
    await prisma().dAT_PHONG.update({ where: { MaDatPhong: holdId }, data: { NgayTao: minutesAgo(TTL + 1) } });
    const after = [(await search())!.ConPhong, (await rooms(roomTypeId)).ConHang, (await quote(roomTypeId)).KhaDung];
    expect(after).toEqual([true, true, true]);
    expect((await book(roomTypeId)).status).toBe(201);
  });
});
