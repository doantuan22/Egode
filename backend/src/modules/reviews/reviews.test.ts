import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
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
import { CloudinaryIntegration } from '../../integrations/cloudinary.integration';
import { getPrismaClient } from '../../config/prisma';
import { ROLE_NAMES } from '../../common/constants/roles';
import { BOOKING_STATUS } from '../../common/constants/hotel-status';
import { REVIEW_STATUS } from '../../common/constants/review';

// Giả lập Cloudinary vì không có thông tin xác thực thật
vi.mock('../../integrations/cloudinary.integration', () => ({
  CloudinaryIntegration: {
    uploadImage: vi.fn().mockResolvedValue({
      url: 'https://res.cloudinary.com/demo/image/upload/v1/hotel-booking/reviews/fake123.jpg',
      publicId: 'hotel-booking/reviews/fake123',
    }),
    deleteImage: vi.fn().mockResolvedValue(true),
  },
}));

const addDays = (days: number): Date => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

const loginAndGetToken = async (email: string, password: string) => {
  const res = await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password });
  return res.body.data.accessToken as string;
};

const accountIds: number[] = [];
const diaPhuongIds: number[] = [];
const hotelIds: number[] = [];
const policyIds: number[] = [];

let hotelId: number;
let policyId: number;
let customerId: number;
let customerToken: string;
let otherCustomerId: number;
let adminToken: string;
let ownerToken: string;

beforeAll(async () => {
  const owner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  accountIds.push(owner.account.MaTaiKhoan);
  ownerToken = await loginAndGetToken(owner.account.Email, owner.plainPassword);

  const admin = await createTestAccount({ role: ROLE_NAMES.ADMIN });
  accountIds.push(admin.account.MaTaiKhoan);
  adminToken = await loginAndGetToken(admin.account.Email, admin.plainPassword);

  const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(customer.account.MaTaiKhoan);
  customerId = customer.account.MaTaiKhoan;
  customerToken = await loginAndGetToken(customer.account.Email, customer.plainPassword);

  const other = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(other.account.MaTaiKhoan);
  otherCustomerId = other.account.MaTaiKhoan;

  const diaPhuong = await createTestDiaPhuong();
  diaPhuongIds.push(diaPhuong.MaDiaPhuong);
  const hotel = await createTestHotel(owner.account.MaTaiKhoan, diaPhuong.MaDiaPhuong);
  hotelIds.push(hotel.MaKhachSan);
  hotelId = hotel.MaKhachSan;

  const policy = await createTestCancellationPolicy([{ soGioTruocNhanPhong: 24, tyLeHoanTien: 50 }]);
  policyIds.push(policy.MaChinhSachHuy);
  policyId = policy.MaChinhSachHuy;
});

afterAll(async () => {
  const prisma = getPrismaClient();
  await prisma.hINH_ANH_DANH_GIA.deleteMany({ where: { DANH_GIA: { MaKhachSan: hotelId } } });
  await prisma.dANH_GIA.deleteMany({ where: { MaKhachSan: hotelId } });
  await prisma.dAT_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });

  await Promise.all(policyIds.map((id) => deleteTestCancellationPolicy(id)));
  await Promise.all(hotelIds.map((id) => deleteTestHotel(id)));
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await Promise.all(diaPhuongIds.map((id) => deleteTestDiaPhuong(id)));
});

const makeBooking = (trangThai: string, checkIn: Date, checkOut: Date, ownerId: number = customerId) =>
  createTestBookingDirect(ownerId, hotelId, policyId, checkIn, checkOut, { trangThai });

describe('Booking completion sweep (M7 §0/§1) — a "Đã xác nhận" stay past checkout becomes "Hoàn tất" lazily', () => {
  it('flips status to "Hoàn tất" on the next booking-detail read, then allows a review', async () => {
    const notYetSwept = await makeBooking(BOOKING_STATUS.CONFIRMED, addDays(-5), addDays(-3));

    const detail = await request(app).get(`/api/bookings/${notYetSwept.MaDatPhong}`).set('Authorization', `Bearer ${customerToken}`);
    expect(detail.body.data.TrangThai).toBe(BOOKING_STATUS.COMPLETED);

    const review = await request(app)
      .post(`/api/bookings/${notYetSwept.MaDatPhong}/review`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ diemDanhGia: 5 });
    expect(review.status).toBe(201);
  });
});

describe('POST /bookings/:id/review', () => {
  it('401 when not authenticated', async () => {
    const booking = await makeBooking(BOOKING_STATUS.COMPLETED, addDays(-10), addDays(-8));
    const res = await request(app).post(`/api/bookings/${booking.MaDatPhong}/review`).send({ diemDanhGia: 5 });
    expect(res.status).toBe(401);
  });

  it('403 when the role is not Khách hàng', async () => {
    const booking = await makeBooking(BOOKING_STATUS.COMPLETED, addDays(-10), addDays(-8));
    const res = await request(app)
      .post(`/api/bookings/${booking.MaDatPhong}/review`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ diemDanhGia: 5 });
    expect(res.status).toBe(403);
  });

  it('404 for a non-existent booking', async () => {
    const res = await request(app)
      .post('/api/bookings/999999999/review')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ diemDanhGia: 5 });
    expect(res.status).toBe(404);
  });

  it("403 when reviewing someone else's booking", async () => {
    const booking = await makeBooking(BOOKING_STATUS.COMPLETED, addDays(-10), addDays(-8), otherCustomerId);
    const res = await request(app)
      .post(`/api/bookings/${booking.MaDatPhong}/review`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ diemDanhGia: 5 });
    expect(res.status).toBe(403);
  });

  it('400 when the booking has not completed its stay yet (still "Đã xác nhận", checkout in the future)', async () => {
    const booking = await makeBooking(BOOKING_STATUS.CONFIRMED, addDays(10), addDays(12));
    const res = await request(app)
      .post(`/api/bookings/${booking.MaDatPhong}/review`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ diemDanhGia: 5 });
    expect(res.status).toBe(400);
  });

  it('400 when the score is out of the 1–5 range', async () => {
    const booking = await makeBooking(BOOKING_STATUS.COMPLETED, addDays(-10), addDays(-8));
    const tooLow = await request(app)
      .post(`/api/bookings/${booking.MaDatPhong}/review`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ diemDanhGia: 0 });
    expect(tooLow.status).toBe(400);

    const tooHigh = await request(app)
      .post(`/api/bookings/${booking.MaDatPhong}/review`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ diemDanhGia: 6 });
    expect(tooHigh.status).toBe(400);
  });

  it('201 creates a review for a completed own booking, published at once ("Hiển thị", no pre-moderation)', async () => {
    const booking = await makeBooking(BOOKING_STATUS.COMPLETED, addDays(-10), addDays(-8));
    const res = await request(app)
      .post(`/api/bookings/${booking.MaDatPhong}/review`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ diemDanhGia: 4, noiDung: 'Phòng sạch, nhân viên thân thiện.' });

    expect(res.status).toBe(201);
    expect(res.body.data.TrangThai).toBe(REVIEW_STATUS.VISIBLE);
    expect(res.body.data.DiemDanhGia).toBe(4);

    const prisma = getPrismaClient();
    const row = await prisma.dANH_GIA.findUnique({ where: { MaDatPhong: booking.MaDatPhong } });
    expect(row?.MaKhachHang).toBe(customerId);
    expect(row?.MaKhachSan).toBe(hotelId);
  });

  it('a new review shows on the public hotel page and in its average straight away, without any admin action', async () => {
    const booking = await makeBooking(BOOKING_STATUS.COMPLETED, addDays(-10), addDays(-8));
    const created = await request(app)
      .post(`/api/bookings/${booking.MaDatPhong}/review`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ diemDanhGia: 5, noiDung: 'Hiển thị ngay sau khi gửi.' });
    expect(created.status).toBe(201);

    const publicList = await request(app).get(`/api/hotels/${hotelId}/reviews`).query({ limit: 50 });

    expect(publicList.status).toBe(200);
    expect(publicList.body.data.map((r: { MaDanhGia: number }) => r.MaDanhGia)).toContain(created.body.data.MaDanhGia);
    expect(publicList.body.summary.SoLuongDanhGia).toBeGreaterThanOrEqual(1);
  });

  it('uploads images via the (mocked) Cloudinary integration and stores their URLs', async () => {
    const booking = await makeBooking(BOOKING_STATUS.COMPLETED, addDays(-10), addDays(-8));
    const fakeImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUAg1WvHmoAAAAASUVORK5CYII=';
    const res = await request(app)
      .post(`/api/bookings/${booking.MaDatPhong}/review`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ diemDanhGia: 5, hinhAnh: [fakeImage, fakeImage] });

    expect(res.status).toBe(201);
    expect(CloudinaryIntegration.uploadImage).toHaveBeenCalledTimes(2);
    expect(res.body.data.HINH_ANH_DANH_GIA).toHaveLength(2);
    expect(res.body.data.HINH_ANH_DANH_GIA[0].URL).toContain('res.cloudinary.com');
  });

  it('400 for an invalid image (wrong mime type)', async () => {
    const booking = await makeBooking(BOOKING_STATUS.COMPLETED, addDays(-10), addDays(-8));
    const res = await request(app)
      .post(`/api/bookings/${booking.MaDatPhong}/review`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ diemDanhGia: 5, hinhAnh: ['data:application/pdf;base64,JVBERi0xLjQK'] });
    expect(res.status).toBe(400);
  });

  it('409 on a duplicate review for the same booking', async () => {
    const booking = await makeBooking(BOOKING_STATUS.COMPLETED, addDays(-10), addDays(-8));
    const first = await request(app)
      .post(`/api/bookings/${booking.MaDatPhong}/review`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ diemDanhGia: 5 });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/bookings/${booking.MaDatPhong}/review`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ diemDanhGia: 3 });
    expect(second.status).toBe(409);
  });
});

describe('GET /bookings/:id/review', () => {
  it('returns null before any review is submitted, then the review after', async () => {
    const booking = await makeBooking(BOOKING_STATUS.COMPLETED, addDays(-10), addDays(-8));
    const before = await request(app).get(`/api/bookings/${booking.MaDatPhong}/review`).set('Authorization', `Bearer ${customerToken}`);
    expect(before.status).toBe(200);
    expect(before.body.data).toBeNull();

    await request(app)
      .post(`/api/bookings/${booking.MaDatPhong}/review`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ diemDanhGia: 5 });

    const after = await request(app).get(`/api/bookings/${booking.MaDatPhong}/review`).set('Authorization', `Bearer ${customerToken}`);
    expect(after.body.data.DiemDanhGia).toBe(5);
  });

  it("403 when checking someone else's booking review", async () => {
    const booking = await makeBooking(BOOKING_STATUS.COMPLETED, addDays(-10), addDays(-8), otherCustomerId);
    const res = await request(app).get(`/api/bookings/${booking.MaDatPhong}/review`).set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });
});

describe('Admin review moderation', () => {
  it('403 for a customer calling admin list/moderate endpoints', async () => {
    const list = await request(app).get('/api/admin/reviews').set('Authorization', `Bearer ${customerToken}`);
    expect(list.status).toBe(403);

    const booking = await makeBooking(BOOKING_STATUS.COMPLETED, addDays(-10), addDays(-8));
    const created = await request(app)
      .post(`/api/bookings/${booking.MaDatPhong}/review`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ diemDanhGia: 5 });

    const moderate = await request(app)
      .patch(`/api/admin/reviews/${created.body.data.MaDanhGia}/moderate`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ trangThai: REVIEW_STATUS.VISIBLE });
    expect(moderate.status).toBe(403);
  });

  it('admin can list, filter by TrangThai, view detail, and moderate (approve/hide/violation)', async () => {
    const booking = await makeBooking(BOOKING_STATUS.COMPLETED, addDays(-10), addDays(-8));
    const created = await request(app)
      .post(`/api/bookings/${booking.MaDatPhong}/review`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ diemDanhGia: 2, noiDung: 'Rất tệ, không đề nghị.' });
    const reviewId = created.body.data.MaDanhGia;

    const list = await request(app)
      .get('/api/admin/reviews')
      .query({ trangThai: REVIEW_STATUS.VISIBLE })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.map((r: { MaDanhGia: number }) => r.MaDanhGia)).toContain(reviewId);

    const detail = await request(app).get(`/api/admin/reviews/${reviewId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.TAI_KHOAN.MaTaiKhoan).toBe(customerId);

    for (const trangThai of [REVIEW_STATUS.VISIBLE, REVIEW_STATUS.HIDDEN, REVIEW_STATUS.VIOLATION]) {
      const moderated = await request(app)
        .patch(`/api/admin/reviews/${reviewId}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ trangThai });
      expect(moderated.status).toBe(200);
      expect(moderated.body.data.TrangThai).toBe(trangThai);
      expect(moderated.body.data.TAI_KHOAN).toEqual(detail.body.data.TAI_KHOAN);
      expect(moderated.body.data.KHACH_SAN).toEqual(detail.body.data.KHACH_SAN);
      expect(moderated.body.data.DAT_PHONG).toEqual(detail.body.data.DAT_PHONG);
      expect(moderated.body.data.HINH_ANH_DANH_GIA).toEqual(detail.body.data.HINH_ANH_DANH_GIA);
    }
  });

  it('admin can filter the list by star score', async () => {
    const low = await makeBooking(BOOKING_STATUS.COMPLETED, addDays(-20), addDays(-18));
    const high = await makeBooking(BOOKING_STATUS.COMPLETED, addDays(-16), addDays(-14));
    const lowReview = await request(app).post(`/api/bookings/${low.MaDatPhong}/review`).set('Authorization', `Bearer ${customerToken}`).send({ diemDanhGia: 1 });
    const highReview = await request(app).post(`/api/bookings/${high.MaDatPhong}/review`).set('Authorization', `Bearer ${customerToken}`).send({ diemDanhGia: 5 });

    const ones = await request(app).get('/api/admin/reviews').query({ diemDanhGia: 1, limit: 100 }).set('Authorization', `Bearer ${adminToken}`);
    expect(ones.status).toBe(200);
    const ids = ones.body.data.map((r: { MaDanhGia: number }) => r.MaDanhGia);
    expect(ids).toContain(lowReview.body.data.MaDanhGia);
    expect(ids).not.toContain(highReview.body.data.MaDanhGia);
    expect(ones.body.data.every((r: { DiemDanhGia: number }) => r.DiemDanhGia === 1)).toBe(true);

    const invalid = await request(app).get('/api/admin/reviews').query({ diemDanhGia: 9 }).set('Authorization', `Bearer ${adminToken}`);
    expect(invalid.status).toBe(400);
  });

  it('404 moderating a non-existent review', async () => {
    const res = await request(app)
      .patch('/api/admin/reviews/999999999/moderate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ trangThai: REVIEW_STATUS.VISIBLE });
    expect(res.status).toBe(404);
  });
});

describe('UC37 safe removal of a violation review', () => {
  it('allows only admins to remove and returns 404 for an unknown review', async () => {
    expect((await request(app).delete('/api/admin/reviews/999999999').set('Authorization', `Bearer ${customerToken}`)).status).toBe(403);
    expect((await request(app).delete('/api/admin/reviews/999999999').set('Authorization', `Bearer ${ownerToken}`)).status).toBe(403);
    expect((await request(app).delete('/api/admin/reviews/999999999').set('Authorization', `Bearer ${adminToken}`)).status).toBe(404);
  });

  it('soft-removes only a flagged review, retains audit relations, and is idempotent', async () => {
    const fakeImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUAg1WvHmoAAAAASUVORK5CYII=';
    const targetBooking = await makeBooking(BOOKING_STATUS.COMPLETED, addDays(-10), addDays(-8));
    const target = await request(app).post(`/api/bookings/${targetBooking.MaDatPhong}/review`).set('Authorization', `Bearer ${customerToken}`).send({ diemDanhGia: 1, noiDung: 'UC37 removed content', hinhAnh: [fakeImage] });
    const targetId = target.body.data.MaDanhGia as number;
    await request(app).patch(`/api/admin/reviews/${targetId}/moderate`).set('Authorization', `Bearer ${adminToken}`).send({ trangThai: REVIEW_STATUS.VIOLATION });

    const otherBooking = await makeBooking(BOOKING_STATUS.COMPLETED, addDays(-14), addDays(-12));
    const other = await request(app).post(`/api/bookings/${otherBooking.MaDatPhong}/review`).set('Authorization', `Bearer ${customerToken}`).send({ diemDanhGia: 5, noiDung: 'UC37 other visible review' });
    const otherId = other.body.data.MaDanhGia as number;
    await request(app).patch(`/api/admin/reviews/${otherId}/moderate`).set('Authorization', `Bearer ${adminToken}`).send({ trangThai: REVIEW_STATUS.VISIBLE });

    // Body bị bỏ qua
    const removed = await request(app).delete(`/api/admin/reviews/${targetId}`).set('Authorization', `Bearer ${adminToken}`).send({ trangThai: REVIEW_STATUS.VISIBLE });
    expect(removed.status).toBe(200); expect(removed.body.data.TrangThai).toBe(REVIEW_STATUS.HIDDEN);
    const prisma = getPrismaClient();
    const retained = await prisma.dANH_GIA.findUnique({ where: { MaDanhGia: targetId }, include: { HINH_ANH_DANH_GIA: true } });
    expect(retained).toMatchObject({ MaDanhGia: targetId, TrangThai: REVIEW_STATUS.HIDDEN }); expect(retained?.HINH_ANH_DANH_GIA).toHaveLength(1);
    expect((await prisma.dANH_GIA.findUniqueOrThrow({ where: { MaDanhGia: otherId } })).TrangThai).toBe(REVIEW_STATUS.VISIBLE);

    const publicDetail = await request(app).get(`/api/hotels/${hotelId}`);
    expect(publicDetail.status).toBe(200); expect(JSON.stringify(publicDetail.body.data)).not.toContain('UC37 removed content');
    // Dữ liệu khách sạn công khai hiện chưa có đánh giá
    expect(publicDetail.body.data).not.toHaveProperty('DANH_GIA');

    const repeated = await request(app).delete(`/api/admin/reviews/${targetId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(repeated.status).toBe(200); expect(repeated.body.data.TrangThai).toBe(REVIEW_STATUS.HIDDEN);
  });
});
