import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  createTestAccount,
  createTestBookingDirect,
  createTestCancellationPolicy,
  createTestDiaPhuong,
  createTestHotel,
  createTestPayment,
  deleteTestAccount,
  deleteTestCancellationPolicy,
  deleteTestDiaPhuong,
  deleteTestHotel,
} from '../../test/factories';
import { getPrismaClient } from '../../config/prisma';
import { ROLE_NAMES } from '../../common/constants/roles';
import { BOOKING_STATUS, HOTEL_STATUS } from '../../common/constants/hotel-status';
import { PAYMENT_STATUS } from '../../common/constants/payment';
import { addDaysToDateKey, businessToday } from '../../common/utils/stay-dates';

/**
 * UC35 — suspending a hotel settles its open bookings: stays already under way become "Hoàn tất", bookings not
 * yet checked in are cancelled, and what was paid for those is refunded in full.
 */
const day = (n: number) => new Date(`${addDaysToDateKey(businessToday(), n)}T00:00:00Z`);
const prisma = () => getPrismaClient();

const accountIds: number[] = [];
const hotelIds: number[] = [];
let locationId = 0;
let policyId = 0;
let ownerId = 0;
let customerId = 0;
let adminToken = '';
const login = async (email: string, password: string) =>
  (await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password })).body.data.accessToken as string;

beforeAll(async () => {
  const [admin, owner, customer] = await Promise.all([
    createTestAccount({ role: ROLE_NAMES.ADMIN }),
    createTestAccount({ role: ROLE_NAMES.PARTNER }),
    createTestAccount({ role: ROLE_NAMES.CUSTOMER }),
  ]);
  accountIds.push(admin.account.MaTaiKhoan, owner.account.MaTaiKhoan, customer.account.MaTaiKhoan);
  ownerId = owner.account.MaTaiKhoan;
  customerId = customer.account.MaTaiKhoan;
  adminToken = await login(admin.account.Email, admin.plainPassword);
  locationId = (await createTestDiaPhuong()).MaDiaPhuong;
  policyId = (await createTestCancellationPolicy([{ soGioTruocNhanPhong: 24, tyLeHoanTien: 50 }])).MaChinhSachHuy;
});

afterAll(async () => {
  for (const id of hotelIds) {
    await prisma().hOAN_TIEN.deleteMany({ where: { THANH_TOAN: { DAT_PHONG: { MaKhachSan: id } } } });
    await prisma().tHANH_TOAN.deleteMany({ where: { DAT_PHONG: { MaKhachSan: id } } });
    await prisma().cHI_TIET_DAT_PHONG.deleteMany({ where: { DAT_PHONG: { MaKhachSan: id } } });
    await prisma().dAT_PHONG.deleteMany({ where: { MaKhachSan: id } });
    await deleteTestHotel(id);
  }
  await deleteTestCancellationPolicy(policyId);
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await deleteTestDiaPhuong(locationId);
});

const newHotel = async () => {
  const hotel = await createTestHotel(ownerId, locationId, { status: HOTEL_STATUS.ACTIVE });
  hotelIds.push(hotel.MaKhachSan);
  return hotel.MaKhachSan;
};
const booking = (hotelId: number, from: number, to: number, trangThai: string, tong = 1_000_000) =>
  createTestBookingDirect(customerId, hotelId, policyId, day(from), day(to), { trangThai, tongTienPhong: tong });
const suspend = (hotelId: number) => request(app).post(`/api/admin/hotels/${hotelId}/suspend`).set('Authorization', `Bearer ${adminToken}`);
const statusOf = async (maDatPhong: number) => (await prisma().dAT_PHONG.findUniqueOrThrow({ where: { MaDatPhong: maDatPhong } })).TrangThai;

describe('admin suspends a hotel that still has bookings', () => {
  it('completes the stay under way, cancels the one not yet checked in and refunds it in full', async () => {
    const hotelId = await newHotel();
    const underway = await booking(hotelId, -1, 2, BOOKING_STATUS.CONFIRMED); // checked in yesterday
    const upcoming = await booking(hotelId, 5, 7, BOOKING_STATUS.CONFIRMED, 2_000_000);
    await createTestPayment(upcoming.MaDatPhong, 2_000_000, PAYMENT_STATUS.SUCCESS);

    const res = await suspend(hotelId);

    expect(res.status).toBe(200);
    expect(res.body.data.TrangThai).toBe(HOTEL_STATUS.SUSPENDED);
    expect(res.body.data.DonDaXuLy).toEqual({ DonHoanTat: 1, DonDaHuy: 1, DonHoanTien: 1 });
    expect(await statusOf(underway.MaDatPhong)).toBe(BOOKING_STATUS.COMPLETED);
    expect(await statusOf(upcoming.MaDatPhong)).toBe(BOOKING_STATUS.CANCELLED);

    const refunds = await prisma().hOAN_TIEN.findMany({ where: { THANH_TOAN: { MaDatPhong: upcoming.MaDatPhong } } });
    expect(refunds).toHaveLength(1);
    expect(Number(refunds[0].SoTienHoan)).toBe(2_000_000); // 100%, not the policy's 50%
    expect(await prisma().hOAN_TIEN.count({ where: { THANH_TOAN: { MaDatPhong: underway.MaDatPhong } } })).toBe(0);

    const hotel = await prisma().kHACH_SAN.findUniqueOrThrow({ where: { MaKhachSan: hotelId } });
    expect(hotel.TrangThai).toBe(HOTEL_STATUS.SUSPENDED);
    expect((await request(app).get(`/api/hotels/${hotelId}`)).status).toBe(404);
  });

  it('cancels a booking still waiting for payment without inventing a refund', async () => {
    const hotelId = await newHotel();
    const waiting = await booking(hotelId, 3, 4, BOOKING_STATUS.PENDING_PAYMENT);

    const res = await suspend(hotelId);

    expect(res.status).toBe(200);
    expect(res.body.data.DonDaXuLy).toEqual({ DonHoanTat: 0, DonDaHuy: 1, DonHoanTien: 0 });
    expect(await statusOf(waiting.MaDatPhong)).toBe(BOOKING_STATUS.CANCELLED);
    expect(await prisma().hOAN_TIEN.count({ where: { THANH_TOAN: { MaDatPhong: waiting.MaDatPhong } } })).toBe(0);
  });

  it('leaves bookings that are already cancelled or completed exactly as they were', async () => {
    const hotelId = await newHotel();
    const cancelled = await booking(hotelId, 4, 5, BOOKING_STATUS.CANCELLED);
    const completed = await booking(hotelId, -10, -8, BOOKING_STATUS.COMPLETED);

    const res = await suspend(hotelId);

    expect(res.status).toBe(200);
    expect(res.body.data.DonDaXuLy).toEqual({ DonHoanTat: 0, DonDaHuy: 0, DonHoanTien: 0 });
    expect(await statusOf(cancelled.MaDatPhong)).toBe(BOOKING_STATUS.CANCELLED);
    expect(await statusOf(completed.MaDatPhong)).toBe(BOOKING_STATUS.COMPLETED);
  });

  it('only a hotel that is "Hoạt động" can be suspended, and suspending twice changes nothing', async () => {
    const pending = (await createTestHotel(ownerId, locationId, { status: HOTEL_STATUS.PENDING_APPROVAL })).MaKhachSan;
    hotelIds.push(pending);
    expect((await suspend(pending)).status).toBe(400);

    const hotelId = await newHotel();
    const upcoming = await booking(hotelId, 6, 7, BOOKING_STATUS.CONFIRMED);
    expect((await suspend(hotelId)).status).toBe(200);
    expect(await statusOf(upcoming.MaDatPhong)).toBe(BOOKING_STATUS.CANCELLED);

    const again = await suspend(hotelId);
    expect(again.status).toBe(200);
    expect(again.body.data.DonDaXuLy).toEqual({ DonHoanTat: 0, DonDaHuy: 0, DonHoanTien: 0 });
  });
});
