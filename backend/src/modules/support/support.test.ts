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
import { SUPPORT_STATUS, SUPPORT_TYPE } from '../../common/constants/support';

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
let otherCustomerToken: string;
let adminId: number;
let adminToken: string;
let ownerToken: string;

beforeAll(async () => {
  const owner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  accountIds.push(owner.account.MaTaiKhoan);
  ownerToken = await loginAndGetToken(owner.account.Email, owner.plainPassword);

  const admin = await createTestAccount({ role: ROLE_NAMES.ADMIN });
  accountIds.push(admin.account.MaTaiKhoan);
  adminId = admin.account.MaTaiKhoan;
  adminToken = await loginAndGetToken(admin.account.Email, admin.plainPassword);

  const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(customer.account.MaTaiKhoan);
  customerId = customer.account.MaTaiKhoan;
  customerToken = await loginAndGetToken(customer.account.Email, customer.plainPassword);

  const other = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(other.account.MaTaiKhoan);
  otherCustomerId = other.account.MaTaiKhoan;
  otherCustomerToken = await loginAndGetToken(other.account.Email, other.plainPassword);

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
  await prisma.yEU_CAU_HO_TRO.deleteMany({ where: { MaTaiKhoanKhachHang: { in: [customerId, otherCustomerId] } } });
  await prisma.dAT_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });

  await Promise.all(policyIds.map((id) => deleteTestCancellationPolicy(id)));
  await Promise.all(hotelIds.map((id) => deleteTestHotel(id)));
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await Promise.all(diaPhuongIds.map((id) => deleteTestDiaPhuong(id)));
});

const makeBooking = (ownerId: number = customerId) =>
  createTestBookingDirect(ownerId, hotelId, policyId, addDays(-10), addDays(-8), { trangThai: BOOKING_STATUS.COMPLETED });

describe('POST /support', () => {
  it('401 when not authenticated', async () => {
    const res = await request(app).post('/api/support').send({ loaiYeuCau: SUPPORT_TYPE.SUPPORT, tieuDe: 'x', noiDung: 'y' });
    expect(res.status).toBe(401);
  });

  it('403 when the role is not Khách hàng', async () => {
    const res = await request(app)
      .post('/api/support')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ loaiYeuCau: SUPPORT_TYPE.SUPPORT, tieuDe: 'x', noiDung: 'y' });
    expect(res.status).toBe(403);
  });

  it('201 creates a request without a MaDatPhong', async () => {
    const res = await request(app)
      .post('/api/support')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ loaiYeuCau: SUPPORT_TYPE.SUPPORT, tieuDe: 'Câu hỏi chung', noiDung: 'Tôi cần hỗ trợ đổi email tài khoản.' });
    expect(res.status).toBe(201);
    expect(res.body.data.TrangThai).toBe(SUPPORT_STATUS.NEW);
    expect(res.body.data.MaDatPhong).toBeNull();
  });

  it('201 creates a complaint attached to the customer\'s own booking', async () => {
    const booking = await makeBooking();
    const res = await request(app)
      .post('/api/support')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ loaiYeuCau: SUPPORT_TYPE.COMPLAINT, tieuDe: 'Phòng không đúng mô tả', noiDung: 'Phòng bẩn khi nhận.', maDatPhong: booking.MaDatPhong });
    expect(res.status).toBe(201);
    expect(res.body.data.MaDatPhong).toBe(booking.MaDatPhong);
    expect(res.body.data.LoaiYeuCau).toBe(SUPPORT_TYPE.COMPLAINT);
  });

  it("403 when the attached MaDatPhong belongs to a different customer", async () => {
    const booking = await makeBooking(otherCustomerId);
    const res = await request(app)
      .post('/api/support')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ loaiYeuCau: SUPPORT_TYPE.COMPLAINT, tieuDe: 'x', noiDung: 'y', maDatPhong: booking.MaDatPhong });
    expect(res.status).toBe(403);
  });

  it('400 for an invalid LoaiYeuCau', async () => {
    const res = await request(app)
      .post('/api/support')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ loaiYeuCau: 'Không hợp lệ', tieuDe: 'x', noiDung: 'y' });
    expect(res.status).toBe(400);
  });
});

describe('GET /support and /support/:id — a customer only ever sees their own requests', () => {
  it('lists only the requesting customer\'s own requests', async () => {
    const mine = await request(app)
      .post('/api/support')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ loaiYeuCau: SUPPORT_TYPE.SUPPORT, tieuDe: 'Của tôi', noiDung: 'noi dung' });
    await request(app)
      .post('/api/support')
      .set('Authorization', `Bearer ${otherCustomerToken}`)
      .send({ loaiYeuCau: SUPPORT_TYPE.SUPPORT, tieuDe: 'Của người khác', noiDung: 'noi dung' });

    const list = await request(app).get('/api/support').set('Authorization', `Bearer ${customerToken}`);
    expect(list.status).toBe(200);
    const titles = list.body.data.map((r: { TieuDe: string }) => r.TieuDe);
    expect(titles).toContain('Của tôi');
    expect(titles).not.toContain('Của người khác');
    void mine;
  });

  it("403 when fetching someone else's request by id", async () => {
    const created = await request(app)
      .post('/api/support')
      .set('Authorization', `Bearer ${otherCustomerToken}`)
      .send({ loaiYeuCau: SUPPORT_TYPE.SUPPORT, tieuDe: 'x', noiDung: 'y' });

    const res = await request(app).get(`/api/support/${created.body.data.MaYeuCauHoTro}`).set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('404 for a non-existent request', async () => {
    const res = await request(app).get('/api/support/999999999').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(404);
  });
});

describe('Admin support handling', () => {
  it('403 for a customer calling admin endpoints', async () => {
    const list = await request(app).get('/api/admin/support').set('Authorization', `Bearer ${customerToken}`);
    expect(list.status).toBe(403);
  });

  it.each([false, true])('admin claims and resolves a request with complete detail relations (linked booking: %s)', async (linkedBooking) => {
    const booking = linkedBooking ? await makeBooking() : null;
    const created = await request(app)
      .post('/api/support')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ loaiYeuCau: SUPPORT_TYPE.COMPLAINT, tieuDe: 'Cần xử lý', noiDung: 'Chi tiết khiếu nại', ...(booking ? { maDatPhong: booking.MaDatPhong } : {}) });
    const id = created.body.data.MaYeuCauHoTro;

    const list = await request(app)
      .get('/api/admin/support')
      .query({ trangThai: SUPPORT_STATUS.NEW, loaiYeuCau: SUPPORT_TYPE.COMPLAINT })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.map((r: { MaYeuCauHoTro: number }) => r.MaYeuCauHoTro)).toContain(id);

    const detail = await request(app).get(`/api/admin/support/${id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(detail.status).toBe(200);

    // Tiếp nhận: người xử lý lấy từ admin đã đăng nhập
    const claim = await request(app)
      .patch(`/api/admin/support/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ trangThai: SUPPORT_STATUS.IN_PROGRESS, maTaiKhoanXuLy: 999999 });
    expect(claim.status).toBe(200);
    expect(claim.body.data.TrangThai).toBe(SUPPORT_STATUS.IN_PROGRESS);
    expect(claim.body.data.TAI_KHOAN_YEU_CAU_HO_TRO_MaTaiKhoanKhachHangToTAI_KHOAN).toEqual(detail.body.data.TAI_KHOAN_YEU_CAU_HO_TRO_MaTaiKhoanKhachHangToTAI_KHOAN);
    expect(claim.body.data.TAI_KHOAN_YEU_CAU_HO_TRO_MaTaiKhoanXuLyToTAI_KHOAN).toMatchObject({ MaTaiKhoan: adminId, HoTen: expect.any(String) });
    expect(claim.body.data.DAT_PHONG).toEqual(detail.body.data.DAT_PHONG);

    const prisma = getPrismaClient();
    const afterClaim = await prisma.yEU_CAU_HO_TRO.findUnique({ where: { MaYeuCauHoTro: id } });
    expect(afterClaim?.MaTaiKhoanXuLy).toBe(adminId);

    // Xử lý cần có kết quả xử lý
    const resolveWithoutResult = await request(app)
      .patch(`/api/admin/support/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ trangThai: SUPPORT_STATUS.RESOLVED });
    expect(resolveWithoutResult.status).toBe(400);

    const resolve = await request(app)
      .patch(`/api/admin/support/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ trangThai: SUPPORT_STATUS.RESOLVED, ketQuaXuLy: 'Đã hoàn tiền cho khách.' });
    expect(resolve.status).toBe(200);
    expect(resolve.body.data.TrangThai).toBe(SUPPORT_STATUS.RESOLVED);
    expect(resolve.body.data.KetQuaXuLy).toBe('Đã hoàn tiền cho khách.');
    expect(resolve.body.data.NgayXuLy).not.toBeNull();
    expect(resolve.body.data.TAI_KHOAN_YEU_CAU_HO_TRO_MaTaiKhoanKhachHangToTAI_KHOAN).toEqual(detail.body.data.TAI_KHOAN_YEU_CAU_HO_TRO_MaTaiKhoanKhachHangToTAI_KHOAN);
    expect(resolve.body.data.TAI_KHOAN_YEU_CAU_HO_TRO_MaTaiKhoanXuLyToTAI_KHOAN).toEqual(claim.body.data.TAI_KHOAN_YEU_CAU_HO_TRO_MaTaiKhoanXuLyToTAI_KHOAN);
    expect(resolve.body.data.DAT_PHONG).toEqual(detail.body.data.DAT_PHONG);

    // Không sửa được sau khi đã xử lý
    const reopenAttempt = await request(app)
      .patch(`/api/admin/support/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ trangThai: SUPPORT_STATUS.IN_PROGRESS });
    expect(reopenAttempt.status).toBe(400);

    // Khách xem được kết quả
    const mineAfter = await request(app).get(`/api/support/${id}`).set('Authorization', `Bearer ${customerToken}`);
    expect(mineAfter.body.data.KetQuaXuLy).toBe('Đã hoàn tiền cho khách.');
  });

  it('404 updating a non-existent request', async () => {
    const res = await request(app)
      .patch('/api/admin/support/999999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ trangThai: SUPPORT_STATUS.IN_PROGRESS });
    expect(res.status).toBe(404);
  });
});
