import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  createTestAccount,
  createTestBookingDirect,
  createTestCancellationPolicy,
  createTestDiaPhuong,
  createTestHotel,
  createTestRoomType,
  deleteTestAccount,
  deleteTestCancellationPolicy,
  deleteTestDiaPhuong,
  deleteTestHotel,
} from '../../test/factories';
import { getPrismaClient } from '../../config/prisma';
import { ROLE_NAMES } from '../../common/constants/roles';
import { BOOKING_STATUS, ROOM_TYPE_STATUS } from '../../common/constants/hotel-status';
import { addDaysToDateKey, businessToday } from '../../common/utils/stay-dates';

/** Chỉ ngừng bán loại phòng khi không còn đơn mở */
const at = (n: number) => new Date(`${addDaysToDateKey(businessToday(), n)}T00:00:00Z`);
const prisma = () => getPrismaClient();

const accountIds: number[] = [];
let locationId = 0;
let policyId = 0;
let hotelId = 0;
let customerId = 0;
let ownerToken = '';
const login = async (email: string, password: string) =>
  (await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password })).body.data.accessToken as string;

beforeAll(async () => {
  const owner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(owner.account.MaTaiKhoan, customer.account.MaTaiKhoan);
  customerId = customer.account.MaTaiKhoan;
  ownerToken = await login(owner.account.Email, owner.plainPassword);
  locationId = (await createTestDiaPhuong()).MaDiaPhuong;
  hotelId = (await createTestHotel(owner.account.MaTaiKhoan, locationId)).MaKhachSan;
  policyId = (await createTestCancellationPolicy([{ soGioTruocNhanPhong: 24, tyLeHoanTien: 100 }])).MaChinhSachHuy;
});

afterAll(async () => {
  await prisma().cHI_TIET_DAT_PHONG.deleteMany({ where: { DAT_PHONG: { MaKhachSan: hotelId } } });
  await prisma().dAT_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });
  await deleteTestCancellationPolicy(policyId);
  await deleteTestHotel(hotelId);
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await deleteTestDiaPhuong(locationId);
});

const newRoomType = async () => (await createTestRoomType(hotelId)).MaLoaiPhong;
const book = async (roomTypeId: number, trangThai: string) => {
  const booking = await createTestBookingDirect(customerId, hotelId, policyId, at(3), at(5), { trangThai });
  await prisma().cHI_TIET_DAT_PHONG.create({ data: { MaDatPhong: booking.MaDatPhong, MaLoaiPhong: roomTypeId, SoLuongPhong: 1 } });
  return booking.MaDatPhong;
};
const deactivate = (id: number) => request(app).post(`/api/owner/room-types/${id}/deactivate`).set('Authorization', `Bearer ${ownerToken}`);
const patchStatus = (id: number, TrangThai: string, extra: object = {}) =>
  request(app).patch(`/api/owner/room-types/${id}`).set('Authorization', `Bearer ${ownerToken}`).send({ TrangThai, ...extra });
const statusOf = async (id: number) => (await prisma().lOAI_PHONG.findUniqueOrThrow({ where: { MaLoaiPhong: id } })).TrangThai;

describe('stopping sales of a room type', () => {
  it('is refused with 409 while a confirmed booking includes it, and nothing changes', async () => {
    const rt = await newRoomType();
    const bookingId = await book(rt, BOOKING_STATUS.CONFIRMED);

    const res = await deactivate(rt);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/1 đơn đặt phòng chưa hoàn tất/);
    expect(await statusOf(rt)).toBe(ROOM_TYPE_STATUS.ACTIVE);
    expect((await prisma().dAT_PHONG.findUniqueOrThrow({ where: { MaDatPhong: bookingId } })).TrangThai).toBe(BOOKING_STATUS.CONFIRMED);
  });

  it('is refused while a booking still waits for payment inside its deadline, but not after the deadline has passed', async () => {
    const rt = await newRoomType();
    const waiting = await book(rt, BOOKING_STATUS.PENDING_PAYMENT);

    expect((await deactivate(rt)).status).toBe(409);
    expect(await statusOf(rt)).toBe(ROOM_TYPE_STATUS.ACTIVE);

    await prisma().dAT_PHONG.update({ where: { MaDatPhong: waiting }, data: { NgayTao: new Date(Date.now() - 24 * 60 * 60 * 1000) } });

    expect((await deactivate(rt)).status).toBe(200);
    expect(await statusOf(rt)).toBe(ROOM_TYPE_STATUS.DISCONTINUED);
    expect((await prisma().dAT_PHONG.findUniqueOrThrow({ where: { MaDatPhong: waiting } })).TrangThai).toBe(BOOKING_STATUS.CANCELLED);
  });

  it('is not blocked by cancelled or completed bookings, nor by open bookings of another room type', async () => {
    const rt = await newRoomType();
    const other = await newRoomType();
    await book(rt, BOOKING_STATUS.CANCELLED);
    await book(rt, BOOKING_STATUS.COMPLETED);
    await book(other, BOOKING_STATUS.CONFIRMED);

    expect((await deactivate(rt)).status).toBe(200);
    expect(await statusOf(rt)).toBe(ROOM_TYPE_STATUS.DISCONTINUED);
    expect(await statusOf(other)).toBe(ROOM_TYPE_STATUS.ACTIVE);
  });

  it('cannot be bypassed by sending TrangThai in a profile update, and the rest of that update is not applied', async () => {
    const rt = await newRoomType();
    await book(rt, BOOKING_STATUS.CONFIRMED);
    const before = (await prisma().lOAI_PHONG.findUniqueOrThrow({ where: { MaLoaiPhong: rt } })).TenLoaiPhong;

    const res = await patchStatus(rt, ROOM_TYPE_STATUS.DISCONTINUED, { TenLoaiPhong: 'Đổi tên khi bị chặn' });

    expect(res.status).toBe(409);
    expect(await statusOf(rt)).toBe(ROOM_TYPE_STATUS.ACTIVE);
    expect((await prisma().lOAI_PHONG.findUniqueOrThrow({ where: { MaLoaiPhong: rt } })).TenLoaiPhong).toBe(before);
  });

  it('through a profile update it works when nothing is open, and the room type can be put back on sale', async () => {
    const rt = await newRoomType();

    const off = await patchStatus(rt, ROOM_TYPE_STATUS.DISCONTINUED, { MoTa: 'Tạm dừng' });
    expect(off.status).toBe(200);
    expect(off.body.data.TrangThai).toBe(ROOM_TYPE_STATUS.DISCONTINUED);
    expect(off.body.data.MoTa).toBe('Tạm dừng');

    const on = await patchStatus(rt, ROOM_TYPE_STATUS.ACTIVE);
    expect(on.status).toBe(200);
    expect(on.body.data.TrangThai).toBe(ROOM_TYPE_STATUS.ACTIVE);
  });

  it('answers deactivate and reactivate with the full room type (amenities, images, hotel), like GET does', async () => {
    const rt = await newRoomType();
    const reactivate = (id: number) => request(app).post(`/api/owner/room-types/${id}/reactivate`).set('Authorization', `Bearer ${ownerToken}`);
    const shape = expect.objectContaining({ LOAI_PHONG_TIEN_NGHI: expect.any(Array), HINH_ANH_LOAI_PHONG: expect.any(Array), KHACH_SAN: expect.objectContaining({ MaKhachSan: hotelId }) });

    const off = await deactivate(rt);
    expect(off.status).toBe(200);
    expect(off.body.data).toEqual(shape);
    expect(off.body.data.TrangThai).toBe(ROOM_TYPE_STATUS.DISCONTINUED);

    const on = await reactivate(rt);
    expect(on.status).toBe(200);
    expect(on.body.data).toEqual(shape);
    expect(on.body.data.TrangThai).toBe(ROOM_TYPE_STATUS.ACTIVE);

    const again = await reactivate(rt);
    expect(again.status).toBe(200);
    expect(again.body.data).toEqual(shape);
  });

  it('is idempotent for a room type that is already stopped', async () => {
    const rt = await newRoomType();
    expect((await deactivate(rt)).status).toBe(200);

    const again = await deactivate(rt);

    expect(again.status).toBe(200);
    expect(again.body.data.TrangThai).toBe(ROOM_TYPE_STATUS.DISCONTINUED);
  });
});
