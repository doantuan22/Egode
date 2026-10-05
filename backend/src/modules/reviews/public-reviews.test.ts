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
import { BOOKING_STATUS, HOTEL_STATUS } from '../../common/constants/hotel-status';
import { REVIEW_STATUS } from '../../common/constants/review';
import { addDaysToDateKey, businessToday } from '../../common/utils/stay-dates';
import { maskReviewerName } from './reviewer-name';

/**
 * Bug #10 — only "Hiển thị" reviews are public (guest or signed in), paginated, with the reviewer's name
 * abbreviated; the rating summary on hotel detail and in search counts those reviews and nothing else.
 */
const day = (n: number) => addDaysToDateKey(businessToday(), n);
const prisma = () => getPrismaClient();

const accountIds: number[] = [];
let diaPhuongId = 0;
let cityName = '';
let policyId = 0;
let hotelId = 0;
let otherHotelId = 0;
let ownerId = 0;
let adminToken = '';
let customerToken = '';
const reviewIds: number[] = [];

const login = async (email: string, password: string) =>
  (await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password })).body.data.accessToken as string;

beforeAll(async () => {
  const [owner, admin, viewer] = await Promise.all([
    createTestAccount({ role: ROLE_NAMES.PARTNER }),
    createTestAccount({ role: ROLE_NAMES.ADMIN }),
    createTestAccount({ role: ROLE_NAMES.CUSTOMER }),
  ]);
  accountIds.push(owner.account.MaTaiKhoan, admin.account.MaTaiKhoan, viewer.account.MaTaiKhoan);
  ownerId = owner.account.MaTaiKhoan;
  adminToken = await login(admin.account.Email, admin.plainPassword);
  customerToken = await login(viewer.account.Email, viewer.plainPassword);
  const dp = await createTestDiaPhuong();
  diaPhuongId = dp.MaDiaPhuong;
  cityName = dp.TenThanhPho;
  hotelId = (await createTestHotel(ownerId, diaPhuongId)).MaKhachSan;
  otherHotelId = (await createTestHotel(ownerId, diaPhuongId)).MaKhachSan;
  await createTestRoomType(hotelId); // a hotel needs an active room type to appear in search
  await createTestRoomType(otherHotelId);
  policyId = (await createTestCancellationPolicy([{ soGioTruocNhanPhong: 24, tyLeHoanTien: 100 }])).MaChinhSachHuy;
});

afterAll(async () => {
  await prisma().hINH_ANH_DANH_GIA.deleteMany({ where: { MaDanhGia: { in: reviewIds } } });
  await prisma().dANH_GIA.deleteMany({ where: { MaDanhGia: { in: reviewIds } } });
  await prisma().dAT_PHONG.deleteMany({ where: { MaKhachSan: { in: [hotelId, otherHotelId] } } });
  await deleteTestCancellationPolicy(policyId);
  await deleteTestHotel(hotelId);
  await deleteTestHotel(otherHotelId);
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await deleteTestDiaPhuong(diaPhuongId);
});

/** One review (and the completed booking it needs) by a new customer with the given real name. */
const addReview = async (opts: { hotel?: number; score: number; status: string; name?: string; text?: string; image?: string }) => {
  const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(customer.account.MaTaiKhoan);
  if (opts.name) await prisma().tAI_KHOAN.update({ where: { MaTaiKhoan: customer.account.MaTaiKhoan }, data: { HoTen: opts.name } });
  const hotel = opts.hotel ?? hotelId;
  const booking = await createTestBookingDirect(customer.account.MaTaiKhoan, hotel, policyId, new Date(`${day(-5)}T00:00:00Z`), new Date(`${day(-3)}T00:00:00Z`), {
    trangThai: BOOKING_STATUS.COMPLETED,
  });
  const review = await prisma().dANH_GIA.create({
    data: {
      MaDatPhong: booking.MaDatPhong,
      MaKhachHang: customer.account.MaTaiKhoan,
      MaKhachSan: hotel,
      DiemDanhGia: opts.score,
      NoiDung: opts.text ?? `Nhận xét ${opts.score} sao`,
      TrangThai: opts.status,
      ...(opts.image ? { HINH_ANH_DANH_GIA: { create: [{ URL: opts.image }] } } : {}),
    },
  });
  reviewIds.push(review.MaDanhGia);
  return { ...review, email: customer.account.Email, accountId: customer.account.MaTaiKhoan, bookingId: booking.MaDatPhong };
};
const clearReviews = async () => {
  await prisma().hINH_ANH_DANH_GIA.deleteMany({ where: { DANH_GIA: { MaKhachSan: { in: [hotelId, otherHotelId] } } } });
  await prisma().dANH_GIA.deleteMany({ where: { MaKhachSan: { in: [hotelId, otherHotelId] } } });
  await prisma().dAT_PHONG.deleteMany({ where: { MaKhachSan: { in: [hotelId, otherHotelId] } } });
};

const publicList = (hotel = hotelId, query: Record<string, unknown> = {}, token?: string) => {
  const req = request(app).get(`/api/hotels/${hotel}/reviews`).query(query);
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};
const detail = async (hotel = hotelId) => (await request(app).get(`/api/hotels/${hotel}`)).body.data as { DanhGia: { DiemTrungBinh: number | null; SoLuongDanhGia: number } };
const moderate = (id: number, trangThai: string) => request(app).patch(`/api/admin/reviews/${id}/moderate`).set('Authorization', `Bearer ${adminToken}`).send({ trangThai });

describe('maskReviewerName', () => {
  it.each([
    ['Nguyễn Văn An', 'Nguyễn V. A.'],
    ['  trần   thị  mai ', 'trần T. M.'],
    ['Lê Đức', 'Lê Đ.'],
    ['Phương', 'P***'],
    ['', 'Khách hàng'],
    [null, 'Khách hàng'],
  ])('%j → %s', (input, expected) => {
    expect(maskReviewerName(input as string | null)).toBe(expected);
  });
});

describe('only "Hiển thị" reviews are public and counted', () => {
  it('a pending review is invisible and uncounted until an admin makes it visible', async () => {
    await clearReviews();
    const pending = await addReview({ score: 5, status: REVIEW_STATUS.PENDING });

    const before = await publicList();
    expect(before.status).toBe(200);
    expect(before.body.data).toEqual([]);
    expect(before.body.summary).toEqual({ DiemTrungBinh: null, SoLuongDanhGia: 0 });
    expect((await detail()).DanhGia).toEqual({ DiemTrungBinh: null, SoLuongDanhGia: 0 });

    expect((await moderate(pending.MaDanhGia, REVIEW_STATUS.VISIBLE)).status).toBe(200);

    const after = await publicList();
    expect(after.body.data.map((r: { MaDanhGia: number }) => r.MaDanhGia)).toEqual([pending.MaDanhGia]);
    expect((await detail()).DanhGia).toEqual({ DiemTrungBinh: 5, SoLuongDanhGia: 1 });
  });

  it('hidden, violation and pending reviews never reach the list or the average', async () => {
    await clearReviews();
    await addReview({ score: 5, status: REVIEW_STATUS.VISIBLE });
    await addReview({ score: 4, status: REVIEW_STATUS.VISIBLE });
    await addReview({ score: 3, status: REVIEW_STATUS.VISIBLE });
    await addReview({ score: 1, status: REVIEW_STATUS.PENDING });
    await addReview({ score: 1, status: REVIEW_STATUS.HIDDEN });
    await addReview({ score: 1, status: REVIEW_STATUS.VIOLATION });

    const res = await publicList();
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data.map((r: { DiemDanhGia: number }) => r.DiemDanhGia).sort()).toEqual([3, 4, 5]);
    expect(res.body.summary).toEqual({ DiemTrungBinh: 4, SoLuongDanhGia: 3 });
    expect((await detail()).DanhGia).toEqual({ DiemTrungBinh: 4, SoLuongDanhGia: 3 });
  });

  it('moderation changes what is public and the aggregate, in both directions', async () => {
    await clearReviews();
    const a = await addReview({ score: 5, status: REVIEW_STATUS.VISIBLE });
    const b = await addReview({ score: 2, status: REVIEW_STATUS.VISIBLE });
    expect((await detail()).DanhGia).toEqual({ DiemTrungBinh: 3.5, SoLuongDanhGia: 2 });

    await moderate(b.MaDanhGia, REVIEW_STATUS.VIOLATION);
    expect((await detail()).DanhGia).toEqual({ DiemTrungBinh: 5, SoLuongDanhGia: 1 });
    expect((await publicList()).body.data.map((r: { MaDanhGia: number }) => r.MaDanhGia)).toEqual([a.MaDanhGia]);

    // UC37 safe removal turns the violation into "Ẩn": still not public.
    expect((await request(app).delete(`/api/admin/reviews/${b.MaDanhGia}`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
    expect((await detail()).DanhGia.SoLuongDanhGia).toBe(1);

    await moderate(a.MaDanhGia, REVIEW_STATUS.HIDDEN);
    expect(await publicList().then((r) => r.body.data)).toEqual([]);
    expect((await detail()).DanhGia).toEqual({ DiemTrungBinh: null, SoLuongDanhGia: 0 });

    await moderate(a.MaDanhGia, REVIEW_STATUS.VISIBLE);
    await moderate(b.MaDanhGia, REVIEW_STATUS.VISIBLE);
    expect((await detail()).DanhGia).toEqual({ DiemTrungBinh: 3.5, SoLuongDanhGia: 2 });
  });

  it("one hotel's reviews never count for another hotel", async () => {
    await clearReviews();
    await addReview({ score: 5, status: REVIEW_STATUS.VISIBLE });
    await addReview({ hotel: otherHotelId, score: 1, status: REVIEW_STATUS.VISIBLE });
    expect((await detail(hotelId)).DanhGia).toEqual({ DiemTrungBinh: 5, SoLuongDanhGia: 1 });
    expect((await detail(otherHotelId)).DanhGia).toEqual({ DiemTrungBinh: 1, SoLuongDanhGia: 1 });
  });
});

describe('who can read them, and what they see', () => {
  it('a guest and a signed-in customer get exactly the same answer', async () => {
    await clearReviews();
    await addReview({ score: 4, status: REVIEW_STATUS.VISIBLE, name: 'Nguyễn Văn An' });
    await addReview({ score: 2, status: REVIEW_STATUS.PENDING });

    const guest = await publicList();
    const customer = await publicList(hotelId, {}, customerToken);
    expect(guest.status).toBe(200);
    expect(customer.status).toBe(200);
    expect(customer.body).toEqual(guest.body);
  });

  it('exposes only the safe fields: abbreviated name, score, text, images — no e-mail, ids of people or bookings', async () => {
    await clearReviews();
    const review = await addReview({ score: 5, status: REVIEW_STATUS.VISIBLE, name: 'Nguyễn Văn An', text: 'Rất tuyệt', image: 'https://img.test/r1.jpg' });

    const body = (await publicList()).body;
    expect(body.data).toEqual([{ MaDanhGia: review.MaDanhGia, DiemDanhGia: 5, NoiDung: 'Rất tuyệt', TenNguoiDanhGia: 'Nguyễn V. A.', HinhAnh: ['https://img.test/r1.jpg'] }]);
    const raw = JSON.stringify(body);
    expect(raw).not.toContain(review.email);
    expect(raw).not.toContain('Nguyễn Văn An');
    for (const leaked of ['Email', 'MaKhachHang', 'MaDatPhong', 'MaTaiKhoan', 'SoDienThoai', 'TrangThai']) expect(raw).not.toContain(leaked);
  });

  it('is paginated, newest first, with totals', async () => {
    await clearReviews();
    for (const score of [1, 2, 3, 4, 5]) await addReview({ score, status: REVIEW_STATUS.VISIBLE });

    const page1 = await publicList(hotelId, { page: 1, limit: 2 });
    const page2 = await publicList(hotelId, { page: 2, limit: 2 });
    const page3 = await publicList(hotelId, { page: 3, limit: 2 });
    expect(page1.body.pagination).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
    expect(page1.body.data.map((r: { DiemDanhGia: number }) => r.DiemDanhGia)).toEqual([5, 4]);
    expect(page2.body.data.map((r: { DiemDanhGia: number }) => r.DiemDanhGia)).toEqual([3, 2]);
    expect(page3.body.data.map((r: { DiemDanhGia: number }) => r.DiemDanhGia)).toEqual([1]);
    expect(page1.body.summary).toEqual({ DiemTrungBinh: 3, SoLuongDanhGia: 5 }); // the summary is about all of them, not the page
  });

  it('rejects an out-of-range limit and hides reviews of a hotel that is not public', async () => {
    expect((await publicList(hotelId, { limit: 500 })).status).toBe(400);
    expect((await publicList(hotelId, { page: 0 })).status).toBe(400);
    expect((await publicList(999_999_999)).status).toBe(404);

    await clearReviews();
    await addReview({ score: 5, status: REVIEW_STATUS.VISIBLE });
    await prisma().kHACH_SAN.update({ where: { MaKhachSan: hotelId }, data: { TrangThai: HOTEL_STATUS.SUSPENDED } });
    try {
      expect((await publicList()).status).toBe(404);
    } finally {
      await prisma().kHACH_SAN.update({ where: { MaKhachSan: hotelId }, data: { TrangThai: HOTEL_STATUS.ACTIVE } });
    }
  });
});

describe('the rating summary in hotel search', () => {
  const found = async () => {
    const res = await request(app).get('/api/hotels').query({ location: cityName, checkIn: day(1), checkOut: day(2), guests: 1 });
    expect(res.status).toBe(200);
    return new Map<number, { DiemTrungBinh: number | null; SoLuongDanhGia: number }>(res.body.data.map((h: { MaKhachSan: number; DiemTrungBinh: number | null; SoLuongDanhGia: number }) => [h.MaKhachSan, h]));
  };

  it('each search item carries the average and count of its VISIBLE reviews only', async () => {
    await clearReviews();
    await addReview({ score: 5, status: REVIEW_STATUS.VISIBLE });
    await addReview({ score: 4, status: REVIEW_STATUS.VISIBLE });
    await addReview({ score: 1, status: REVIEW_STATUS.HIDDEN });
    await addReview({ score: 1, status: REVIEW_STATUS.PENDING });

    const items = await found();
    expect(items.get(hotelId)).toMatchObject({ DiemTrungBinh: 4.5, SoLuongDanhGia: 2 });
    expect(items.get(otherHotelId)).toMatchObject({ DiemTrungBinh: null, SoLuongDanhGia: 0 });
  });

  it('follows moderation', async () => {
    await clearReviews();
    const review = await addReview({ score: 3, status: REVIEW_STATUS.PENDING });
    expect((await found()).get(hotelId)).toMatchObject({ DiemTrungBinh: null, SoLuongDanhGia: 0 });
    await moderate(review.MaDanhGia, REVIEW_STATUS.VISIBLE);
    expect((await found()).get(hotelId)).toMatchObject({ DiemTrungBinh: 3, SoLuongDanhGia: 1 });
  });
});
