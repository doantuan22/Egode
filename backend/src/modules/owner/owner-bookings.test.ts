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
  createTestCancellationPolicy,
  deleteTestCancellationPolicy,
  createTestBookingDirect,
} from '../../test/factories';
import { getPrismaClient } from '../../config/prisma';
import { ROLE_NAMES } from '../../common/constants/roles';
import { BOOKING_STATUS } from '../../common/constants/hotel-status';

const addDays = (days: number): Date => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

const login = async (email: string, password: string) =>
  (await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password })).body.data.accessToken as string;

const accountIds: number[] = [];
let diaPhuongId: number;
let policyId: number;
let hotelId: number;
let otherHotelId: number;
let bookingId: number;
let ownerToken: string;
let otherOwnerToken: string;

beforeAll(async () => {
  const owner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  const otherOwner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(owner.account.MaTaiKhoan, otherOwner.account.MaTaiKhoan, customer.account.MaTaiKhoan);
  ownerToken = await login(owner.account.Email, owner.plainPassword);
  otherOwnerToken = await login(otherOwner.account.Email, otherOwner.plainPassword);

  diaPhuongId = (await createTestDiaPhuong()).MaDiaPhuong;
  hotelId = (await createTestHotel(owner.account.MaTaiKhoan, diaPhuongId)).MaKhachSan;
  otherHotelId = (await createTestHotel(otherOwner.account.MaTaiKhoan, diaPhuongId)).MaKhachSan;
  policyId = (await createTestCancellationPolicy([{ soGioTruocNhanPhong: 24, tyLeHoanTien: 50 }])).MaChinhSachHuy;

  const booking = await createTestBookingDirect(customer.account.MaTaiKhoan, hotelId, policyId, addDays(10), addDays(12), {
    trangThai: BOOKING_STATUS.CONFIRMED,
    ghiChu: 'Nhận phòng muộn khoảng 22h.',
  });
  bookingId = booking.MaDatPhong;
});

afterAll(async () => {
  const prisma = getPrismaClient();
  await prisma.dAT_PHONG.deleteMany({ where: { MaKhachSan: { in: [hotelId, otherHotelId] } } });
  await deleteTestHotel(hotelId);
  await deleteTestHotel(otherHotelId);
  await deleteTestCancellationPolicy(policyId);
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await deleteTestDiaPhuong(diaPhuongId);
});

describe('GET /api/owner/hotels/:hotelId/bookings (UC24)', () => {
  it('returns the operational fields the hotel needs: guest phone, guest note, check-in/out times', async () => {
    const res = await request(app).get(`/api/owner/hotels/${hotelId}/bookings/${bookingId}`).set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.KhachHang.SoDienThoai).toBe('0900000000');
    expect(res.body.data.GhiChu).toBe('Nhận phòng muộn khoảng 22h.');
    expect(res.body.data.GioNhanPhong).toBe('14:00');
    expect(res.body.data.GioTraPhong).toBe('12:00');
  });

  it('never exposes the guest email or password hash to the hotel', async () => {
    const res = await request(app).get(`/api/owner/hotels/${hotelId}/bookings`).set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((b: { MaDatPhong: number }) => b.MaDatPhong)).toContain(bookingId);
    const serialized = JSON.stringify(res.body.data);
    expect(serialized).not.toContain('Email');
    expect(serialized).not.toContain('MatKhau');
  });

  it('searches by confirmation code or guest name', async () => {
    const byName = await request(app).get(`/api/owner/hotels/${hotelId}/bookings`).query({ search: 'Test User' }).set('Authorization', `Bearer ${ownerToken}`);
    expect(byName.body.data.map((b: { MaDatPhong: number }) => b.MaDatPhong)).toContain(bookingId);
    const noMatch = await request(app).get(`/api/owner/hotels/${hotelId}/bookings`).query({ search: 'Không Tồn Tại' }).set('Authorization', `Bearer ${ownerToken}`);
    expect(noMatch.body.data).toHaveLength(0);
  });

  it("returns 403 for another owner's hotel and 404 for a booking outside the hotel", async () => {
    const foreign = await request(app).get(`/api/owner/hotels/${hotelId}/bookings`).set('Authorization', `Bearer ${otherOwnerToken}`);
    expect(foreign.status).toBe(403);
    const wrongHotel = await request(app).get(`/api/owner/hotels/${otherHotelId}/bookings/${bookingId}`).set('Authorization', `Bearer ${otherOwnerToken}`);
    expect(wrongHotel.status).toBe(404);
  });
});

describe('GET /api/owner/hotels (dashboard counts)', () => {
  it('includes how many room types each owned hotel has', async () => {
    const res = await request(app).get('/api/owner/hotels').set('Authorization', `Bearer ${ownerToken}`);
    const hotel = res.body.data.find((h: { MaKhachSan: number }) => h.MaKhachSan === hotelId);
    expect(hotel._count.LOAI_PHONG).toBe(0);
  });
});
