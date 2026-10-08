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
import { REVIEW_STATUS } from '../../common/constants/review';
import { addDaysToDateKey, businessToday } from '../../common/utils/stay-dates';

/** GET /api/owner/hotels/:id/reviews — an owner reads the moderated reviews of their own hotels, and only theirs. */

const day = (n: number) => addDaysToDateKey(businessToday(), n);
const prisma = () => getPrismaClient();
const login = async (email: string, password: string) =>
  (await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password })).body.data.accessToken as string;

const accountIds: number[] = [];
let diaPhuongId = 0;
let policyId = 0;
let ownerId = 0;
let hotelId = 0;
let secondHotelId = 0;
let strangerHotelId = 0;
let ownerToken = '';
let strangerToken = '';
let customerToken = '';

const asOwner = (url: string, token = ownerToken) => request(app).get(url).set('Authorization', `Bearer ${token}`);

const addReview = async (opts: { hotel: number; score: number; status: string; name?: string; text?: string; image?: string }) => {
  const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(customer.account.MaTaiKhoan);
  if (opts.name) await prisma().tAI_KHOAN.update({ where: { MaTaiKhoan: customer.account.MaTaiKhoan }, data: { HoTen: opts.name } });
  const booking = await createTestBookingDirect(customer.account.MaTaiKhoan, opts.hotel, policyId, new Date(`${day(-5)}T00:00:00Z`), new Date(`${day(-3)}T00:00:00Z`), {
    trangThai: BOOKING_STATUS.COMPLETED,
  });
  return prisma().dANH_GIA.create({
    data: {
      MaDatPhong: booking.MaDatPhong,
      MaKhachHang: customer.account.MaTaiKhoan,
      MaKhachSan: opts.hotel,
      DiemDanhGia: opts.score,
      NoiDung: opts.text ?? `Nhận xét ${opts.score} sao`,
      TrangThai: opts.status,
      ...(opts.image ? { HINH_ANH_DANH_GIA: { create: [{ URL: opts.image }] } } : {}),
    },
  });
};

beforeAll(async () => {
  const [owner, stranger, customer] = await Promise.all([
    createTestAccount({ role: ROLE_NAMES.PARTNER }),
    createTestAccount({ role: ROLE_NAMES.PARTNER }),
    createTestAccount({ role: ROLE_NAMES.CUSTOMER }),
  ]);
  accountIds.push(owner.account.MaTaiKhoan, stranger.account.MaTaiKhoan, customer.account.MaTaiKhoan);
  ownerId = owner.account.MaTaiKhoan;
  ownerToken = await login(owner.account.Email, owner.plainPassword);
  strangerToken = await login(stranger.account.Email, stranger.plainPassword);
  customerToken = await login(customer.account.Email, customer.plainPassword);

  diaPhuongId = (await createTestDiaPhuong()).MaDiaPhuong;
  hotelId = (await createTestHotel(ownerId, diaPhuongId)).MaKhachSan;
  secondHotelId = (await createTestHotel(ownerId, diaPhuongId)).MaKhachSan;
  strangerHotelId = (await createTestHotel(stranger.account.MaTaiKhoan, diaPhuongId)).MaKhachSan;
  policyId = (await createTestCancellationPolicy([{ soGioTruocNhanPhong: 24, tyLeHoanTien: 100 }])).MaChinhSachHuy;

  await addReview({ hotel: hotelId, score: 5, status: REVIEW_STATUS.VISIBLE, name: 'Nguyễn Văn An', text: 'Tuyệt vời', image: 'https://img.test/a.jpg' });
  await addReview({ hotel: hotelId, score: 5, status: REVIEW_STATUS.VISIBLE });
  await addReview({ hotel: hotelId, score: 3, status: REVIEW_STATUS.VISIBLE });
  await addReview({ hotel: hotelId, score: 1, status: REVIEW_STATUS.PENDING, text: 'chưa duyệt' });
  await addReview({ hotel: hotelId, score: 1, status: REVIEW_STATUS.VIOLATION, text: 'vi phạm' });
  await addReview({ hotel: hotelId, score: 2, status: REVIEW_STATUS.HIDDEN, text: 'đã ẩn' });
  await addReview({ hotel: secondHotelId, score: 4, status: REVIEW_STATUS.VISIBLE, text: 'khách sạn thứ hai' });
  await addReview({ hotel: strangerHotelId, score: 2, status: REVIEW_STATUS.VISIBLE, text: 'của người khác' });
});

afterAll(async () => {
  const hotels = [hotelId, secondHotelId, strangerHotelId];
  await prisma().hINH_ANH_DANH_GIA.deleteMany({ where: { DANH_GIA: { MaKhachSan: { in: hotels } } } });
  await prisma().dANH_GIA.deleteMany({ where: { MaKhachSan: { in: hotels } } });
  await prisma().dAT_PHONG.deleteMany({ where: { MaKhachSan: { in: hotels } } });
  await deleteTestCancellationPolicy(policyId);
  await Promise.all(hotels.map((id) => deleteTestHotel(id)));
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await deleteTestDiaPhuong(diaPhuongId);
});

describe('GET /api/owner/hotels/:id/reviews', () => {
  it('lists only the moderated ("Hiển thị") reviews of that hotel, newest first, with a masked name and the stay dates', async () => {
    const res = await asOwner(`/api/owner/hotels/${hotelId}/reviews`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data.map((r: { DiemDanhGia: number }) => r.DiemDanhGia)).toEqual([3, 5, 5]);
    const everything = JSON.stringify(res.body.data);
    for (const hidden of ['chưa duyệt', 'vi phạm', 'đã ẩn', 'khách sạn thứ hai', 'của người khác']) {
      expect(everything).not.toContain(hidden);
    }

    const first = res.body.data.find((r: { NoiDung: string }) => r.NoiDung === 'Tuyệt vời');
    expect(first.TenNguoiDanhGia).toBe('Nguyễn V. A.');
    expect(first.HinhAnh).toEqual(['https://img.test/a.jpg']);
    expect(first.NgayNhanPhong).toBe(day(-5));
    expect(first.NgayTraPhong).toBe(day(-3));
    // Nothing that identifies the guest beyond the abbreviation.
    expect(first).not.toHaveProperty('TAI_KHOAN');
    expect(first).not.toHaveProperty('Email');
    expect(first).not.toHaveProperty('MaKhachHang');
  });

  it('reports the average, the count and the score distribution of the visible reviews only', async () => {
    const res = await asOwner(`/api/owner/hotels/${hotelId}/reviews`);

    expect(res.body.summary.SoLuongDanhGia).toBe(3);
    expect(res.body.summary.DiemTrungBinh).toBe(4.3); // (5 + 5 + 3) / 3
    expect(res.body.summary.PhanBoDiem).toEqual({ 1: 0, 2: 0, 3: 1, 4: 0, 5: 2 });
    expect(res.body.pagination).toMatchObject({ page: 1, total: 3, totalPages: 1 });
  });

  it('filters by score without changing the overall summary, and paginates', async () => {
    const five = await asOwner(`/api/owner/hotels/${hotelId}/reviews?diemDanhGia=5`);
    expect(five.body.data).toHaveLength(2);
    expect(five.body.pagination.total).toBe(2);
    expect(five.body.summary.SoLuongDanhGia).toBe(3);
    expect(five.body.summary.PhanBoDiem[3]).toBe(1);

    const paged = await asOwner(`/api/owner/hotels/${hotelId}/reviews?limit=2&page=2`);
    expect(paged.body.data).toHaveLength(1);
    expect(paged.body.pagination).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });

    const none = await asOwner(`/api/owner/hotels/${hotelId}/reviews?diemDanhGia=1`);
    expect(none.body.data).toEqual([]);
  });

  it('serves each of the owner\'s hotels separately', async () => {
    const res = await asOwner(`/api/owner/hotels/${secondHotelId}/reviews`);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].NoiDung).toBe('khách sạn thứ hai');
    expect(res.body.summary).toMatchObject({ SoLuongDanhGia: 1, DiemTrungBinh: 4 });
  });

  it('returns an empty result, not an error, for a hotel with no reviews yet', async () => {
    const empty = (await createTestHotel(ownerId, diaPhuongId)).MaKhachSan;
    try {
      const res = await asOwner(`/api/owner/hotels/${empty}/reviews`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.summary).toMatchObject({ SoLuongDanhGia: 0, DiemTrungBinh: null });
    } finally {
      await deleteTestHotel(empty);
    }
  });

  it('refuses another owner\'s hotel (403), an unknown hotel (404), a customer (403) and no token (401)', async () => {
    expect((await asOwner(`/api/owner/hotels/${strangerHotelId}/reviews`)).status).toBe(403);
    expect((await asOwner(`/api/owner/hotels/${hotelId}/reviews`, strangerToken)).status).toBe(403);
    expect((await asOwner('/api/owner/hotels/999999999/reviews')).status).toBe(404);
    expect((await asOwner(`/api/owner/hotels/${hotelId}/reviews`, customerToken)).status).toBe(403);
    expect((await request(app).get(`/api/owner/hotels/${hotelId}/reviews`)).status).toBe(401);
  });

  it('rejects an invalid score or page size', async () => {
    expect((await asOwner(`/api/owner/hotels/${hotelId}/reviews?diemDanhGia=6`)).status).toBe(400);
    expect((await asOwner(`/api/owner/hotels/${hotelId}/reviews?limit=500`)).status).toBe(400);
  });
});
