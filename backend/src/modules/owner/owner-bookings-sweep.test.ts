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
import { env } from '../../config/env';
import { ROLE_NAMES } from '../../common/constants/roles';
import { BOOKING_STATUS } from '../../common/constants/hotel-status';

/** Chủ khách sạn thấy cùng trạng thái đơn như khách */

const addDays = (days: number): Date => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

const login = async (email: string, password: string) =>
  (await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password })).body.data.accessToken as string;

const accountIds: number[] = [];
let diaPhuongId: number;
let policyId: number;
let hotelId: number;
let otherHotelId: number;
let customerId: number;
let ownerToken: string;
let otherOwnerToken: string;

const base = () => `/api/owner/hotels/${hotelId}/bookings`;
const asOwner = (path: string, query: Record<string, string> = {}) => request(app).get(path).query(query).set('Authorization', `Bearer ${ownerToken}`);

/** Đơn chờ thanh toán đã quá hạn giữ chỗ */
const makeStalePending = (forHotel = hotelId) =>
  createTestBookingDirect(customerId, forHotel, policyId, addDays(20), addDays(22), {
    trangThai: BOOKING_STATUS.PENDING_PAYMENT,
    ngayTao: minutesAgo(env.PAYMENT_TIMEOUT_MINUTES + 5),
  });
/** Đơn chờ thanh toán còn trong hạn */
const makeFreshPending = () =>
  createTestBookingDirect(customerId, hotelId, policyId, addDays(20), addDays(22), {
    trangThai: BOOKING_STATUS.PENDING_PAYMENT,
    ngayTao: minutesAgo(1),
  });
/** Đơn xác nhận đã trả phòng */
const makeFinishedConfirmed = () =>
  createTestBookingDirect(customerId, hotelId, policyId, addDays(-5), addDays(-3), { trangThai: BOOKING_STATUS.CONFIRMED });
/** Đơn xác nhận chưa hết lưu trú */
const makeUpcomingConfirmed = () =>
  createTestBookingDirect(customerId, hotelId, policyId, addDays(10), addDays(12), { trangThai: BOOKING_STATUS.CONFIRMED });

const dbRow = (id: number) => getPrismaClient().dAT_PHONG.findUniqueOrThrow({ where: { MaDatPhong: id } });
const statusOf = (items: Array<{ MaDatPhong: number; TrangThai: string }>, id: number) => items.find((b) => b.MaDatPhong === id)?.TrangThai;

beforeAll(async () => {
  const owner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  const otherOwner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(owner.account.MaTaiKhoan, otherOwner.account.MaTaiKhoan, customer.account.MaTaiKhoan);
  customerId = customer.account.MaTaiKhoan;
  ownerToken = await login(owner.account.Email, owner.plainPassword);
  otherOwnerToken = await login(otherOwner.account.Email, otherOwner.plainPassword);

  diaPhuongId = (await createTestDiaPhuong()).MaDiaPhuong;
  hotelId = (await createTestHotel(owner.account.MaTaiKhoan, diaPhuongId)).MaKhachSan;
  otherHotelId = (await createTestHotel(otherOwner.account.MaTaiKhoan, diaPhuongId)).MaKhachSan;
  policyId = (await createTestCancellationPolicy([{ soGioTruocNhanPhong: 24, tyLeHoanTien: 50 }])).MaChinhSachHuy;
});

afterAll(async () => {
  await getPrismaClient().dAT_PHONG.deleteMany({ where: { MaKhachSan: { in: [hotelId, otherHotelId] } } });
  await deleteTestHotel(hotelId);
  await deleteTestHotel(otherHotelId);
  await deleteTestCancellationPolicy(policyId);
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await deleteTestDiaPhuong(diaPhuongId);
});

describe('GET /owner/hotels/:hotelId/bookings/:bookingId — passive sweeps (BUG-008)', () => {
  it('A1. a stale "Chờ thanh toán" booking is returned as "Đã hủy"', async () => {
    const booking = await makeStalePending();
    const res = await asOwner(`${base()}/${booking.MaDatPhong}`);
    expect(res.status).toBe(200);
    expect(res.body.data.TrangThai).toBe(BOOKING_STATUS.CANCELLED);
    expect((await dbRow(booking.MaDatPhong)).TrangThai).toBe(BOOKING_STATUS.CANCELLED);
  });

  it('A2. a finished "Đã xác nhận" booking is returned as "Hoàn tất"', async () => {
    const booking = await makeFinishedConfirmed();
    const res = await asOwner(`${base()}/${booking.MaDatPhong}`);
    expect(res.status).toBe(200);
    expect(res.body.data.TrangThai).toBe(BOOKING_STATUS.COMPLETED);
    expect((await dbRow(booking.MaDatPhong)).TrangThai).toBe(BOOKING_STATUS.COMPLETED);
  });

  it('D. bookings that are not due are left alone (fresh pending, upcoming confirmed)', async () => {
    const pending = await makeFreshPending();
    const confirmed = await makeUpcomingConfirmed();

    const pendingRes = await asOwner(`${base()}/${pending.MaDatPhong}`);
    const confirmedRes = await asOwner(`${base()}/${confirmed.MaDatPhong}`);
    expect(pendingRes.body.data.TrangThai).toBe(BOOKING_STATUS.PENDING_PAYMENT);
    expect(confirmedRes.body.data.TrangThai).toBe(BOOKING_STATUS.CONFIRMED);

    const list = await asOwner(base(), { limit: '100' });
    expect(statusOf(list.body.data, pending.MaDatPhong)).toBe(BOOKING_STATUS.PENDING_PAYMENT);
    expect(statusOf(list.body.data, confirmed.MaDatPhong)).toBe(BOOKING_STATUS.CONFIRMED);
    expect((await dbRow(pending.MaDatPhong)).TrangThai).toBe(BOOKING_STATUS.PENDING_PAYMENT);
    expect((await dbRow(confirmed.MaDatPhong)).TrangThai).toBe(BOOKING_STATUS.CONFIRMED);
  });
});

describe('GET /owner/hotels/:hotelId/bookings — passive sweeps (BUG-008)', () => {
  it('B. the list returns swept statuses for both a stale pending and a finished confirmed booking', async () => {
    const stale = await makeStalePending();
    const finished = await makeFinishedConfirmed();

    const res = await asOwner(base(), { limit: '100' });
    expect(res.status).toBe(200);
    expect(statusOf(res.body.data, stale.MaDatPhong)).toBe(BOOKING_STATUS.CANCELLED);
    expect(statusOf(res.body.data, finished.MaDatPhong)).toBe(BOOKING_STATUS.COMPLETED);
  });

  it('C. the sweep runs BEFORE the status filter: a just-expired booking shows up under "Đã hủy" in the same request', async () => {
    const stale = await makeStalePending();
    const finished = await makeFinishedConfirmed();

    const cancelled = await asOwner(base(), { trangThai: BOOKING_STATUS.CANCELLED, limit: '100' });
    expect(cancelled.body.data.map((b: { MaDatPhong: number }) => b.MaDatPhong)).toContain(stale.MaDatPhong);
    expect(cancelled.body.data.every((b: { TrangThai: string }) => b.TrangThai === BOOKING_STATUS.CANCELLED)).toBe(true);

    const completed = await asOwner(base(), { trangThai: BOOKING_STATUS.COMPLETED, limit: '100' });
    expect(completed.body.data.map((b: { MaDatPhong: number }) => b.MaDatPhong)).toContain(finished.MaDatPhong);
  });

  it('C2. ...and it no longer appears under the old status filters, and the total/pagination agree', async () => {
    const stale = await makeStalePending();
    const finished = await makeFinishedConfirmed();

    const pending = await asOwner(base(), { trangThai: BOOKING_STATUS.PENDING_PAYMENT, limit: '100' });
    expect(pending.body.data.map((b: { MaDatPhong: number }) => b.MaDatPhong)).not.toContain(stale.MaDatPhong);
    const confirmed = await asOwner(base(), { trangThai: BOOKING_STATUS.CONFIRMED, limit: '100' });
    expect(confirmed.body.data.map((b: { MaDatPhong: number }) => b.MaDatPhong)).not.toContain(finished.MaDatPhong);

    const all = await asOwner(base(), { limit: '100' });
    const cancelledCount = await asOwner(base(), { trangThai: BOOKING_STATUS.CANCELLED, limit: '1' });
    expect(cancelledCount.body.pagination.total).toBe(all.body.data.filter((b: { TrangThai: string }) => b.TrangThai === BOOKING_STATUS.CANCELLED).length);
  });
});

describe('owner bookings — authorization happens before any sweep (BUG-008)', () => {
  it('E1. a non-owner gets 403 and the system-wide sweep is NOT triggered', async () => {
    const stale = await makeStalePending();
    const finished = await makeFinishedConfirmed();

    const list = await request(app).get(base()).set('Authorization', `Bearer ${otherOwnerToken}`);
    const one = await request(app).get(`${base()}/${stale.MaDatPhong}`).set('Authorization', `Bearer ${otherOwnerToken}`);
    expect(list.status).toBe(403);
    expect(one.status).toBe(403);

    // Yêu cầu bị từ chối không ghi gì
    expect((await dbRow(stale.MaDatPhong)).TrangThai).toBe(BOOKING_STATUS.PENDING_PAYMENT);
    expect((await dbRow(finished.MaDatPhong)).TrangThai).toBe(BOOKING_STATUS.CONFIRMED);
  });

  it('E2. an unknown hotel gets 404 and the sweep is NOT triggered', async () => {
    const stale = await makeStalePending();
    const finished = await makeFinishedConfirmed();

    const list = await asOwner('/api/owner/hotels/999999999/bookings');
    const one = await asOwner(`/api/owner/hotels/999999999/bookings/${stale.MaDatPhong}`);
    expect(list.status).toBe(404);
    expect(one.status).toBe(404);

    expect((await dbRow(stale.MaDatPhong)).TrangThai).toBe(BOOKING_STATUS.PENDING_PAYMENT);
    expect((await dbRow(finished.MaDatPhong)).TrangThai).toBe(BOOKING_STATUS.CONFIRMED);
  });

  it('E3. an unauthenticated or non-partner caller is rejected without a sweep', async () => {
    const stale = await makeStalePending();
    expect((await request(app).get(base())).status).toBe(401);
    expect((await dbRow(stale.MaDatPhong)).TrangThai).toBe(BOOKING_STATUS.PENDING_PAYMENT);
  });

  it('E4. an owner still gets 404 for a booking of another hotel (existing contract unchanged)', async () => {
    const foreign = await makeStalePending(otherHotelId);
    const res = await asOwner(`${base()}/${foreign.MaDatPhong}`);
    expect(res.status).toBe(404);
  });

  it('E5. the owner of the hotel is accepted and the sweep does run (positive control for E1)', async () => {
    const stale = await makeStalePending();
    expect((await asOwner(base())).status).toBe(200);
    expect((await dbRow(stale.MaDatPhong)).TrangThai).toBe(BOOKING_STATUS.CANCELLED);
  });
});

describe('owner bookings — sweeps are idempotent (BUG-008)', () => {
  it('F. repeated list/getOne calls keep the same statuses, never error and never rewrite already-swept rows', async () => {
    const stale = await makeStalePending();
    const finished = await makeFinishedConfirmed();
    const pending = await makeFreshPending();

    await asOwner(base());
    const afterFirst = {
      stale: await dbRow(stale.MaDatPhong),
      finished: await dbRow(finished.MaDatPhong),
      pending: await dbRow(pending.MaDatPhong),
    };

    for (let i = 0; i < 4; i++) {
      const list = await asOwner(base(), { limit: '100' });
      const oneStale = await asOwner(`${base()}/${stale.MaDatPhong}`);
      const oneFinished = await asOwner(`${base()}/${finished.MaDatPhong}`);
      expect(list.status).toBe(200);
      expect(oneStale.status).toBe(200);
      expect(oneFinished.status).toBe(200);
      expect(statusOf(list.body.data, stale.MaDatPhong)).toBe(BOOKING_STATUS.CANCELLED);
      expect(statusOf(list.body.data, finished.MaDatPhong)).toBe(BOOKING_STATUS.COMPLETED);
      expect(statusOf(list.body.data, pending.MaDatPhong)).toBe(BOOKING_STATUS.PENDING_PAYMENT);
      expect(oneStale.body.data.TrangThai).toBe(BOOKING_STATUS.CANCELLED);
      expect(oneFinished.body.data.TrangThai).toBe(BOOKING_STATUS.COMPLETED);
    }

    const afterMany = {
      stale: await dbRow(stale.MaDatPhong),
      finished: await dbRow(finished.MaDatPhong),
      pending: await dbRow(pending.MaDatPhong),
    };
    // Lặp lại không ghi lại hay chú thích thêm
    expect(afterMany.stale.NgayCapNhat).toEqual(afterFirst.stale.NgayCapNhat);
    expect(afterMany.stale.GhiChu).toBe(afterFirst.stale.GhiChu);
    expect(afterMany.finished.NgayCapNhat).toEqual(afterFirst.finished.NgayCapNhat);
    expect(afterMany.pending.TrangThai).toBe(BOOKING_STATUS.PENDING_PAYMENT);
  });

  it('F2. concurrent owner reads do not produce errors or inconsistent statuses', async () => {
    const stale = await makeStalePending();
    const finished = await makeFinishedConfirmed();

    const responses = await Promise.all([
      ...Array.from({ length: 6 }, () => asOwner(base(), { limit: '100' })),
      ...Array.from({ length: 6 }, () => asOwner(`${base()}/${stale.MaDatPhong}`)),
      ...Array.from({ length: 6 }, () => asOwner(`${base()}/${finished.MaDatPhong}`)),
    ]);
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect((await dbRow(stale.MaDatPhong)).TrangThai).toBe(BOOKING_STATUS.CANCELLED);
    expect((await dbRow(finished.MaDatPhong)).TrangThai).toBe(BOOKING_STATUS.COMPLETED);
  });
});
