import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { BOOKING_STATUS } from '../../common/constants/hotel-status';
import { ROLE_NAMES } from '../../common/constants/roles';
import { getPrismaClient } from '../../config/prisma';
import {
  createTestAccount,
  createTestBookingDirect,
  createTestCancellationPolicy,
  createTestDiaPhuong,
  createTestHotel,
  createTestPayment,
  createTestRefund,
  createTestRoomType,
  deleteTestAccount,
  deleteTestCancellationPolicy,
  deleteTestDiaPhuong,
  deleteTestHotel,
} from '../../test/factories';

const accountIds: number[] = [];
const locationIds: number[] = [];
let hotelId = 0;
let policyId = 0;
let bookingId = 0;
let paymentId = 0;
let confirmationCode = '';
let adminToken = '';
let customerToken = '';
let ownerToken = '';

const tokenFor = async (email: string, password: string) =>
  (await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password })).body.data.accessToken as string;

beforeAll(async () => {
  const [admin, customer, owner] = await Promise.all([
    createTestAccount({ role: ROLE_NAMES.ADMIN }),
    createTestAccount({ role: ROLE_NAMES.CUSTOMER }),
    createTestAccount({ role: ROLE_NAMES.PARTNER }),
  ]);
  accountIds.push(admin.account.MaTaiKhoan, customer.account.MaTaiKhoan, owner.account.MaTaiKhoan);
  [adminToken, customerToken, ownerToken] = await Promise.all([
    tokenFor(admin.account.Email, admin.plainPassword),
    tokenFor(customer.account.Email, customer.plainPassword),
    tokenFor(owner.account.Email, owner.plainPassword),
  ]);

  const location = await createTestDiaPhuong();
  locationIds.push(location.MaDiaPhuong);
  const hotel = await createTestHotel(owner.account.MaTaiKhoan, location.MaDiaPhuong);
  hotelId = hotel.MaKhachSan;
  const roomType = await createTestRoomType(hotelId);
  const policy = await createTestCancellationPolicy([{ soGioTruocNhanPhong: 24, tyLeHoanTien: 50 }]);
  policyId = policy.MaChinhSachHuy;
  const booking = await createTestBookingDirect(
    customer.account.MaTaiKhoan,
    hotelId,
    policyId,
    new Date('2035-05-10'),
    new Date('2035-05-12'),
    { trangThai: BOOKING_STATUS.CONFIRMED, ghiChu: 'Phòng tầng cao' }
  );
  bookingId = booking.MaDatPhong;
  confirmationCode = booking.MaXacNhanDatPhong;
  await getPrismaClient().cHI_TIET_DAT_PHONG.create({
    data: { MaDatPhong: bookingId, MaLoaiPhong: roomType.MaLoaiPhong, SoLuongPhong: 2 },
  });
  const payment = await createTestPayment(bookingId, 1_000_000);
  paymentId = payment.MaThanhToan;
  await createTestRefund(paymentId, 100_000);
});

afterAll(async () => {
  const prisma = getPrismaClient();
  await prisma.hOAN_TIEN.deleteMany({ where: { MaThanhToan: paymentId } });
  await prisma.tHANH_TOAN.deleteMany({ where: { MaDatPhong: bookingId } });
  await prisma.cHI_TIET_DAT_PHONG.deleteMany({ where: { MaDatPhong: bookingId } });
  await prisma.dAT_PHONG.deleteMany({ where: { MaDatPhong: bookingId } });
  await deleteTestCancellationPolicy(policyId);
  await deleteTestHotel(hotelId);
  await Promise.all(accountIds.map(deleteTestAccount));
  await Promise.all(locationIds.map(deleteTestDiaPhuong));
});

describe('admin bookings', () => {
  it('allows only administrators', async () => {
    expect((await request(app).get('/api/admin/bookings')).status).toBe(401);
    expect((await request(app).get('/api/admin/bookings').set('Authorization', `Bearer ${customerToken}`)).status).toBe(403);
    expect((await request(app).get('/api/admin/bookings').set('Authorization', `Bearer ${ownerToken}`)).status).toBe(403);
  });

  it('lists all-system bookings with search, status, hotel and check-in date filters', async () => {
    const response = await request(app)
      .get(`/api/admin/bookings?page=1&limit=20&search=${confirmationCode}&trangThai=${encodeURIComponent(BOOKING_STATUS.CONFIRMED)}&hotelId=${hotelId}&from=2035-05-01&to=2035-05-31`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    const row = response.body.data.find((item: { MaDatPhong: number }) => item.MaDatPhong === bookingId);
    expect(row).toMatchObject({
      MaXacNhanDatPhong: confirmationCode,
      TongSoPhong: 2,
      TrangThai: BOOKING_STATUS.CONFIRMED,
      KhachSan: { MaKhachSan: hotelId },
    });
    expect(response.body.pagination.total).toBeGreaterThanOrEqual(1);

    const noMatch = await request(app)
      .get(`/api/admin/bookings?search=${confirmationCode}&trangThai=${encodeURIComponent(BOOKING_STATUS.CANCELLED)}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(noMatch.body.data.some((item: { MaDatPhong: number }) => item.MaDatPhong === bookingId)).toBe(false);
  });

  it('returns operational detail without account credentials or provider callback data', async () => {
    const response = await request(app)
      .get(`/api/admin/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      MaDatPhong: bookingId,
      MaXacNhanDatPhong: confirmationCode,
      GhiChu: 'Phòng tầng cao',
      KhachSan: { MaKhachSan: hotelId },
    });
    expect(response.body.data.ChiTietPhong).toHaveLength(1);
    expect(response.body.data.ThanhToan[0].HoanTien).toHaveLength(1);
    expect(response.body.data.ChinhSachHuy.ChiTiet).toHaveLength(1);
    const serialized = JSON.stringify(response.body.data);
    expect(serialized).not.toContain('MatKhau');
    expect(serialized).not.toContain('Email');
    expect(serialized).not.toContain('vnp_SecureHash');
  });

  it('validates status and date ranges', async () => {
    const invalidStatus = await request(app)
      .get('/api/admin/bookings?trangThai=Không hợp lệ')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalidStatus.status).toBe(400);

    const invalidRange = await request(app)
      .get('/api/admin/bookings?from=2035-05-20&to=2035-05-10')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalidRange.status).toBe(400);
  });
});
