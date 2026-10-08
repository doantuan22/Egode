import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { createTestAccount, createTestDiaPhuong, createTestHotel, deleteTestAccount, deleteTestDiaPhuong, deleteTestHotel } from '../../test/factories';
import { ROLE_NAMES } from '../../common/constants/roles';
import { HOTEL_STATUS } from '../../common/constants/hotel-status';
import { getPrismaClient } from '../../config/prisma';

const accountIds: number[] = []; const hotelIds: number[] = []; const locationIds: number[] = [];
let adminToken = ''; let customerToken = ''; let ownerToken = ''; let hotelId = 0;
const tokenFor = async (email: string, password: string) => (await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password })).body.data.accessToken as string;

beforeAll(async () => {
  const [admin, customer, owner] = await Promise.all([createTestAccount({ role: ROLE_NAMES.ADMIN }), createTestAccount({ role: ROLE_NAMES.CUSTOMER }), createTestAccount({ role: ROLE_NAMES.PARTNER })]);
  accountIds.push(admin.account.MaTaiKhoan, customer.account.MaTaiKhoan, owner.account.MaTaiKhoan);
  [adminToken, customerToken, ownerToken] = await Promise.all([tokenFor(admin.account.Email, admin.plainPassword), tokenFor(customer.account.Email, customer.plainPassword), tokenFor(owner.account.Email, owner.plainPassword)]);
  const location = await createTestDiaPhuong(); locationIds.push(location.MaDiaPhuong);
  const hotel = await createTestHotel(owner.account.MaTaiKhoan, location.MaDiaPhuong, { status: HOTEL_STATUS.ACTIVE }); hotelId = hotel.MaKhachSan; hotelIds.push(hotelId);
});
afterAll(async () => { await Promise.all(hotelIds.map(deleteTestHotel)); await Promise.all(accountIds.map(deleteTestAccount)); await Promise.all(locationIds.map(deleteTestDiaPhuong)); });

describe('admin hotel management (UC33/UC34)', () => {
  it('rejects customer and owner access with 403', async () => {
    expect((await request(app).get('/api/admin/hotels').set('Authorization', `Bearer ${customerToken}`)).status).toBe(403);
    expect((await request(app).get('/api/admin/hotels').set('Authorization', `Bearer ${ownerToken}`)).status).toBe(403);
  });

  it('lets an admin list and update only editable hotel fields', async () => {
    const list = await request(app).get('/api/admin/hotels?page=1&limit=20').set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200); expect(list.body.data.some((hotel: { MaKhachSan: number }) => hotel.MaKhachSan === hotelId)).toBe(true);
    const updated = await request(app).patch(`/api/admin/hotels/${hotelId}`).set('Authorization', `Bearer ${adminToken}`).send({ TenKhachSan: 'Hotel updated by admin', HangSao: 4 });
    expect(updated.status).toBe(200); expect(updated.body.data).toMatchObject({ MaKhachSan: hotelId, TenKhachSan: 'Hotel updated by admin', HangSao: 4 });
  });

  it('shows the owner (name, email, phone only) and the photos, cover first, in the detail and the list', async () => {
    const prisma = getPrismaClient();
    await prisma.hINH_ANH_KHACH_SAN.createMany({
      data: [
        { MaKhachSan: hotelId, URL: 'https://example.com/second.jpg', AnhDaiDien: false },
        { MaKhachSan: hotelId, URL: 'https://example.com/cover.jpg', AnhDaiDien: true },
      ],
    });
    const detail = await request(app).get(`/api/admin/hotels/${hotelId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(detail.status).toBe(200);
    const owner = detail.body.data.TAI_KHOAN_KHACH_SAN_MaTaiKhoanSoHuuToTAI_KHOAN;
    expect(Object.keys(owner).sort()).toEqual(['Email', 'HoTen', 'MaTaiKhoan', 'SoDienThoai']);
    expect(detail.body.data.HINH_ANH_KHACH_SAN.map((image: { URL: string }) => image.URL)).toEqual([
      'https://example.com/cover.jpg',
      'https://example.com/second.jpg',
    ]);

    const list = await request(app).get('/api/admin/hotels?page=1&limit=100').set('Authorization', `Bearer ${adminToken}`);
    const row = list.body.data.find((hotel: { MaKhachSan: number }) => hotel.MaKhachSan === hotelId);
    expect(row.TAI_KHOAN_KHACH_SAN_MaTaiKhoanSoHuuToTAI_KHOAN.HoTen).toBe(owner.HoTen);
    expect(row.HINH_ANH_KHACH_SAN).toHaveLength(1);
    expect(row.HINH_ANH_KHACH_SAN[0].URL).toBe('https://example.com/cover.jpg');
  });

  it('suspends a hotel so it disappears from public sellable discovery, then reactivates it', async () => {
    const suspended = await request(app).post(`/api/admin/hotels/${hotelId}/suspend`).set('Authorization', `Bearer ${adminToken}`);
    expect(suspended.status).toBe(200); expect(suspended.body.data.TrangThai).toBe(HOTEL_STATUS.SUSPENDED);
    expect((await request(app).get(`/api/hotels/${hotelId}`)).status).toBe(404);
    const reactivated = await request(app).post(`/api/admin/hotels/${hotelId}/reactivate`).set('Authorization', `Bearer ${adminToken}`);
    expect(reactivated.status).toBe(200); expect(reactivated.body.data.TrangThai).toBe(HOTEL_STATUS.ACTIVE);
    expect((await request(app).get(`/api/hotels/${hotelId}`)).status).toBe(200);
  });
});

describe('hotel approval workflow (Bug #1)', () => {
  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${adminToken}`);
  const asOwner = (req: request.Test) => req.set('Authorization', `Bearer ${ownerToken}`);
  const createdHotelIds: number[] = [];
  let adminAccountId = 0;
  let locationId = 0;

  const newHotelPayload = () => ({
    TenKhachSan: `Approval Flow Hotel ${Date.now()}${Math.floor(Math.random() * 1000)}`,
    DiaChiChiTiet: '99 Approval Street',
    HangSao: 3,
    GioNhanPhong: '14:00',
    GioTraPhong: '12:00',
    MaDiaPhuong: locationId,
  });
  const ownerCreatesHotel = async () => {
    const res = await asOwner(request(app).post('/api/owner/hotels')).send(newHotelPayload());
    expect(res.status).toBe(201);
    createdHotelIds.push(res.body.data.MaKhachSan);
    return res.body.data as { MaKhachSan: number; TrangThai: string };
  };
  const publicStatus = async (id: number) => (await request(app).get(`/api/hotels/${id}`)).status;
  const dbHotel = (id: number) => getPrismaClient().kHACH_SAN.findUniqueOrThrow({ where: { MaKhachSan: id } });

  beforeAll(async () => {
    const location = await createTestDiaPhuong();
    locationId = location.MaDiaPhuong;
    locationIds.push(locationId);
    const admin = await createTestAccount({ role: ROLE_NAMES.ADMIN });
    accountIds.push(admin.account.MaTaiKhoan);
    adminAccountId = admin.account.MaTaiKhoan;
    adminToken = await tokenFor(admin.account.Email, admin.plainPassword);
  });
  afterAll(async () => {
    await Promise.all(createdHotelIds.map(deleteTestHotel));
  });

  it('owner creates a hotel as "Chờ duyệt" and it is not public', async () => {
    const hotel = await ownerCreatesHotel();
    expect(hotel.TrangThai).toBe(HOTEL_STATUS.PENDING_APPROVAL);
    expect(await publicStatus(hotel.MaKhachSan)).toBe(404);
    const row = await dbHotel(hotel.MaKhachSan);
    expect(row.MaTaiKhoanDuyet).toBeNull();
    expect(row.NgayDuyet).toBeNull();
  });

  it('admin approve → "Hoạt động", records MaTaiKhoanDuyet + NgayDuyet, and the hotel becomes public', async () => {
    const hotel = await ownerCreatesHotel();
    const res = await asAdmin(request(app).post(`/api/admin/hotels/${hotel.MaKhachSan}/approve`));
    expect(res.status).toBe(200);
    expect(res.body.data.TrangThai).toBe(HOTEL_STATUS.ACTIVE);

    const row = await dbHotel(hotel.MaKhachSan);
    expect(row.TrangThai).toBe(HOTEL_STATUS.ACTIVE);
    expect(row.MaTaiKhoanDuyet).toBe(adminAccountId);
    expect(row.NgayDuyet).toBeInstanceOf(Date);
    expect(await publicStatus(hotel.MaKhachSan)).toBe(200);
  });

  it('approving twice, or approving a hotel that does not exist, is rejected', async () => {
    const hotel = await ownerCreatesHotel();
    expect((await asAdmin(request(app).post(`/api/admin/hotels/${hotel.MaKhachSan}/approve`))).status).toBe(200);
    expect((await asAdmin(request(app).post(`/api/admin/hotels/${hotel.MaKhachSan}/approve`))).status).toBe(400);
    expect((await asAdmin(request(app).post('/api/admin/hotels/999999999/approve'))).status).toBe(404);
  });

  it('admin reject → "Từ chối", never public, and no admin action can move it on afterwards', async () => {
    const hotel = await ownerCreatesHotel();
    const res = await asAdmin(request(app).post(`/api/admin/hotels/${hotel.MaKhachSan}/reject`));
    expect(res.status).toBe(200);
    expect(res.body.data.TrangThai).toBe(HOTEL_STATUS.REJECTED);
    expect(await publicStatus(hotel.MaKhachSan)).toBe(404);
    for (const action of ['approve', 'reactivate', 'suspend', 'reject']) {
      expect((await asAdmin(request(app).post(`/api/admin/hotels/${hotel.MaKhachSan}/${action}`))).status).toBe(400);
    }
    expect((await dbHotel(hotel.MaKhachSan)).TrangThai).toBe(HOTEL_STATUS.REJECTED);
  });

  it('reactivate is not a shortcut to approval: a pending hotel can be neither reactivated nor suspended', async () => {
    const hotel = await ownerCreatesHotel();
    expect((await asAdmin(request(app).post(`/api/admin/hotels/${hotel.MaKhachSan}/reactivate`))).status).toBe(400);
    expect((await asAdmin(request(app).post(`/api/admin/hotels/${hotel.MaKhachSan}/suspend`))).status).toBe(400);
    expect((await dbHotel(hotel.MaKhachSan)).TrangThai).toBe(HOTEL_STATUS.PENDING_APPROVAL);
    expect(await publicStatus(hotel.MaKhachSan)).toBe(404);
  });

  it('two approvals at once: exactly one succeeds', async () => {
    const hotel = await ownerCreatesHotel();
    const results = await Promise.all([
      asAdmin(request(app).post(`/api/admin/hotels/${hotel.MaKhachSan}/approve`)),
      asAdmin(request(app).post(`/api/admin/hotels/${hotel.MaKhachSan}/approve`)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
  });

  it('admin suspend → not public; admin reactivate → public again', async () => {
    const hotel = await ownerCreatesHotel();
    await asAdmin(request(app).post(`/api/admin/hotels/${hotel.MaKhachSan}/approve`));
    const suspended = await asAdmin(request(app).post(`/api/admin/hotels/${hotel.MaKhachSan}/suspend`));
    expect(suspended.body.data.TrangThai).toBe(HOTEL_STATUS.SUSPENDED);
    expect(await publicStatus(hotel.MaKhachSan)).toBe(404);
    const reactivated = await asAdmin(request(app).post(`/api/admin/hotels/${hotel.MaKhachSan}/reactivate`));
    expect(reactivated.body.data.TrangThai).toBe(HOTEL_STATUS.ACTIVE);
    expect(await publicStatus(hotel.MaKhachSan)).toBe(200);
  });

  it('owner deactivate → not public; owner reactivate of an approved hotel → public again', async () => {
    const hotel = await ownerCreatesHotel();
    await asAdmin(request(app).post(`/api/admin/hotels/${hotel.MaKhachSan}/approve`));

    const off = await asOwner(request(app).post(`/api/owner/hotels/${hotel.MaKhachSan}/deactivate`));
    expect(off.status).toBe(200);
    expect(off.body.data.TrangThai).toBe(HOTEL_STATUS.INACTIVE);
    expect(await publicStatus(hotel.MaKhachSan)).toBe(404);

    const on = await asOwner(request(app).post(`/api/owner/hotels/${hotel.MaKhachSan}/reactivate`));
    expect(on.status).toBe(200);
    expect(on.body.data.TrangThai).toBe(HOTEL_STATUS.ACTIVE);
    expect(await publicStatus(hotel.MaKhachSan)).toBe(200);
  });

  it('owner cannot activate a hotel an admin never approved (pending / rejected / inactive without approval)', async () => {
    const pending = await ownerCreatesHotel();
    expect((await asOwner(request(app).post(`/api/owner/hotels/${pending.MaKhachSan}/reactivate`))).status).toBe(400);
    expect((await asOwner(request(app).post(`/api/owner/hotels/${pending.MaKhachSan}/deactivate`))).status).toBe(400);

    await asAdmin(request(app).post(`/api/admin/hotels/${pending.MaKhachSan}/reject`));
    expect((await asOwner(request(app).post(`/api/owner/hotels/${pending.MaKhachSan}/reactivate`))).status).toBe(400);

    // Forged state: INACTIVE but with no approval trail must still be refused.
    const never = await ownerCreatesHotel();
    await getPrismaClient().kHACH_SAN.update({ where: { MaKhachSan: never.MaKhachSan }, data: { TrangThai: HOTEL_STATUS.INACTIVE } });
    expect((await asOwner(request(app).post(`/api/owner/hotels/${never.MaKhachSan}/reactivate`))).status).toBe(400);

    for (const h of [pending, never]) expect(await publicStatus(h.MaKhachSan)).toBe(404);
  });

  it('owner cannot reactivate or deactivate a hotel suspended by an admin', async () => {
    const hotel = await ownerCreatesHotel();
    await asAdmin(request(app).post(`/api/admin/hotels/${hotel.MaKhachSan}/approve`));
    await asAdmin(request(app).post(`/api/admin/hotels/${hotel.MaKhachSan}/suspend`));
    expect((await asOwner(request(app).post(`/api/owner/hotels/${hotel.MaKhachSan}/reactivate`))).status).toBe(400);
    expect((await asOwner(request(app).post(`/api/owner/hotels/${hotel.MaKhachSan}/deactivate`))).status).toBe(400);
    expect((await dbHotel(hotel.MaKhachSan)).TrangThai).toBe(HOTEL_STATUS.SUSPENDED);
  });

  it('a customer or an owner cannot drive the admin workflow', async () => {
    const hotel = await ownerCreatesHotel();
    for (const action of ['approve', 'reject']) {
      expect((await request(app).post(`/api/admin/hotels/${hotel.MaKhachSan}/${action}`).set('Authorization', `Bearer ${customerToken}`)).status).toBe(403);
      expect((await asOwner(request(app).post(`/api/admin/hotels/${hotel.MaKhachSan}/${action}`))).status).toBe(403);
    }
    expect((await request(app).post(`/api/owner/hotels/${hotel.MaKhachSan}/reactivate`).set('Authorization', `Bearer ${customerToken}`)).status).toBe(403);
    expect((await dbHotel(hotel.MaKhachSan)).TrangThai).toBe(HOTEL_STATUS.PENDING_APPROVAL);
  });

  it('the admin list can be filtered to the approval queue ("Chờ duyệt")', async () => {
    const hotel = await ownerCreatesHotel();
    const res = await asAdmin(request(app).get(`/api/admin/hotels?TrangThai=${encodeURIComponent(HOTEL_STATUS.PENDING_APPROVAL)}&limit=100`));
    expect(res.status).toBe(200);
    const ids = res.body.data.map((h: { MaKhachSan: number; TrangThai: string }) => {
      expect(h.TrangThai).toBe(HOTEL_STATUS.PENDING_APPROVAL);
      return h.MaKhachSan;
    });
    expect(ids).toContain(hotel.MaKhachSan);
  });
});
