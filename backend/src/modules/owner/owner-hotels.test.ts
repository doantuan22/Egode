import { describe, it, expect, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  createTestAccount,
  deleteTestAccount,
  createTestDiaPhuong,
  deleteTestDiaPhuong,
  createTestHotel,
  deleteTestHotel,
  createTestAmenity,
  deleteTestAmenity,
} from '../../test/factories';
import { ROLE_NAMES } from '../../common/constants/roles';
import { HOTEL_STATUS } from '../../common/constants/hotel-status';
import { CloudinaryIntegration } from '../../integrations/cloudinary.integration';

// Giả lập Cloudinary vì là dịch vụ bên ngoài
vi.mock('../../integrations/cloudinary.integration', () => ({
  CloudinaryIntegration: {
    uploadImage: vi.fn().mockResolvedValue({ url: 'https://res.cloudinary.com/demo/image/upload/v1/hotel-booking/hotels/fake123.jpg', publicId: 'hotel-booking/hotels/fake123' }),
    deleteImage: vi.fn().mockResolvedValue(true),
  },
}));

const accountIds: number[] = [];
const diaPhuongIds: number[] = [];
const hotelIds: number[] = [];
const amenityIds: number[] = [];

afterAll(async () => {
  await Promise.all(hotelIds.map((id) => deleteTestHotel(id)));
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await Promise.all(diaPhuongIds.map((id) => deleteTestDiaPhuong(id)));
  await Promise.all(amenityIds.map((id) => deleteTestAmenity(id)));
});

const loginAndGetToken = async (email: string, password: string) => {
  const res = await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password });
  return res.body.data.accessToken as string;
};

const makeOwner = async () => {
  const { account, plainPassword } = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  accountIds.push(account.MaTaiKhoan);
  const token = await loginAndGetToken(account.Email, plainPassword);
  return { account, token };
};

describe('RBAC on /api/owner/hotels', () => {
  it('rejects a customer token with 403', async () => {
    const { account, plainPassword } = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
    accountIds.push(account.MaTaiKhoan);
    const token = await loginAndGetToken(account.Email, plainPassword);

    const res = await request(app).get('/api/owner/hotels').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('rejects requests with no token', async () => {
    const res = await request(app).get('/api/owner/hotels');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/owner/hotels (create)', () => {
  it('creates a hotel owned by the authenticated user, defaulting to pending approval', async () => {
    const { account, token } = await makeOwner();
    const diaPhuong = await createTestDiaPhuong();
    diaPhuongIds.push(diaPhuong.MaDiaPhuong);

    const res = await request(app)
      .post('/api/owner/hotels')
      .set('Authorization', `Bearer ${token}`)
      .send({
        TenKhachSan: 'My New Hotel',
        DiaChiChiTiet: '123 Test Street',
        HangSao: 4,
        MoTa: 'A nice hotel',
        GioNhanPhong: '14:00',
        GioTraPhong: '12:00',
        MaDiaPhuong: diaPhuong.MaDiaPhuong,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.TrangThai).toBe(HOTEL_STATUS.PENDING_APPROVAL);
    expect(res.body.data.MaTaiKhoanSoHuu).toBe(account.MaTaiKhoan);
    hotelIds.push(res.body.data.MaKhachSan);
  });

  it('ignores a client-supplied MaTaiKhoanSoHuu/TrangThai (mass-assignment guard)', async () => {
    const { account, token } = await makeOwner();
    const diaPhuong = await createTestDiaPhuong();
    diaPhuongIds.push(diaPhuong.MaDiaPhuong);

    const res = await request(app)
      .post('/api/owner/hotels')
      .set('Authorization', `Bearer ${token}`)
      .send({
        TenKhachSan: 'Sneaky Hotel',
        DiaChiChiTiet: '456 Test Street',
        HangSao: 5,
        GioNhanPhong: '14:00',
        GioTraPhong: '12:00',
        MaDiaPhuong: diaPhuong.MaDiaPhuong,
        MaTaiKhoanSoHuu: 999999,
        TrangThai: HOTEL_STATUS.ACTIVE,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.MaTaiKhoanSoHuu).toBe(account.MaTaiKhoan);
    expect(res.body.data.TrangThai).toBe(HOTEL_STATUS.PENDING_APPROVAL);
    hotelIds.push(res.body.data.MaKhachSan);
  });

  it('rejects a non-existent MaDiaPhuong', async () => {
    const { token } = await makeOwner();
    const res = await request(app)
      .post('/api/owner/hotels')
      .set('Authorization', `Bearer ${token}`)
      .send({
        TenKhachSan: 'Ghost Hotel',
        DiaChiChiTiet: '789 Test Street',
        HangSao: 3,
        GioNhanPhong: '14:00',
        GioTraPhong: '12:00',
        MaDiaPhuong: 999999,
      });
    expect(res.status).toBe(400);
  });
});

describe('Ownership enforcement (cross-owner access)', () => {
  it('returns 403 when Owner A tries to view/update Owner B hotel', async () => {
    const ownerA = await makeOwner();
    const ownerB = await makeOwner();
    const diaPhuong = await createTestDiaPhuong();
    diaPhuongIds.push(diaPhuong.MaDiaPhuong);
    const hotel = await createTestHotel(ownerA.account.MaTaiKhoan, diaPhuong.MaDiaPhuong);
    hotelIds.push(hotel.MaKhachSan);

    const getRes = await request(app)
      .get(`/api/owner/hotels/${hotel.MaKhachSan}`)
      .set('Authorization', `Bearer ${ownerB.token}`);
    expect(getRes.status).toBe(403);

    const patchRes = await request(app)
      .patch(`/api/owner/hotels/${hotel.MaKhachSan}`)
      .set('Authorization', `Bearer ${ownerB.token}`)
      .send({ TenKhachSan: 'Hijacked Name' });
    expect(patchRes.status).toBe(403);

    // Dữ liệu của chủ sở hữu không bị thay đổi
    const ok = await request(app)
      .get(`/api/owner/hotels/${hotel.MaKhachSan}`)
      .set('Authorization', `Bearer ${ownerA.token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.TenKhachSan).not.toBe('Hijacked Name');
  });

  it('returns 404 for a hotel id that does not exist at all', async () => {
    const { token } = await makeOwner();
    const res = await request(app).get('/api/owner/hotels/999999999').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('only lists the caller\'s own hotels', async () => {
    const ownerA = await makeOwner();
    const ownerB = await makeOwner();
    const diaPhuong = await createTestDiaPhuong();
    diaPhuongIds.push(diaPhuong.MaDiaPhuong);
    const hotelA = await createTestHotel(ownerA.account.MaTaiKhoan, diaPhuong.MaDiaPhuong);
    const hotelB = await createTestHotel(ownerB.account.MaTaiKhoan, diaPhuong.MaDiaPhuong);
    hotelIds.push(hotelA.MaKhachSan, hotelB.MaKhachSan);

    const res = await request(app).get('/api/owner/hotels').set('Authorization', `Bearer ${ownerA.token}`);
    const ids = res.body.data.map((h: { MaKhachSan: number }) => h.MaKhachSan);
    expect(ids).toContain(hotelA.MaKhachSan);
    expect(ids).not.toContain(hotelB.MaKhachSan);
  });
});

describe('PATCH /api/owner/hotels/:id (update)', () => {
  it('updates own hotel info but cannot change TrangThai/approval fields', async () => {
    const { account, token } = await makeOwner();
    const diaPhuong = await createTestDiaPhuong();
    diaPhuongIds.push(diaPhuong.MaDiaPhuong);
    const hotel = await createTestHotel(account.MaTaiKhoan, diaPhuong.MaDiaPhuong, {
      status: HOTEL_STATUS.PENDING_APPROVAL,
    });
    hotelIds.push(hotel.MaKhachSan);

    const res = await request(app)
      .patch(`/api/owner/hotels/${hotel.MaKhachSan}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ TenKhachSan: 'Updated Name', TrangThai: HOTEL_STATUS.ACTIVE });

    expect(res.status).toBe(200);
    expect(res.body.data.TenKhachSan).toBe('Updated Name');
    expect(res.body.data.TrangThai).toBe(HOTEL_STATUS.PENDING_APPROVAL);
  });
});

describe('Amenities + images', () => {
  it('replaces hotel amenities', async () => {
    const { account, token } = await makeOwner();
    const diaPhuong = await createTestDiaPhuong();
    diaPhuongIds.push(diaPhuong.MaDiaPhuong);
    const hotel = await createTestHotel(account.MaTaiKhoan, diaPhuong.MaDiaPhuong);
    hotelIds.push(hotel.MaKhachSan);
    const amenity = await createTestAmenity();
    amenityIds.push(amenity.MaTienNghi);

    const res = await request(app)
      .put(`/api/owner/hotels/${hotel.MaKhachSan}/amenities`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amenityIds: [amenity.MaTienNghi] });

    expect(res.status).toBe(200);
    expect(res.body.data.KHACH_SAN_TIEN_NGHI.map((k: { MaTienNghi: number }) => k.MaTienNghi)).toContain(
      amenity.MaTienNghi
    );
  });

  it('uploads an image via the (mocked) Cloudinary integration and can remove it', async () => {
    const { account, token } = await makeOwner();
    const diaPhuong = await createTestDiaPhuong();
    diaPhuongIds.push(diaPhuong.MaDiaPhuong);
    const hotel = await createTestHotel(account.MaTaiKhoan, diaPhuong.MaDiaPhuong);
    hotelIds.push(hotel.MaKhachSan);

    const uploadRes = await request(app)
      .post(`/api/owner/hotels/${hotel.MaKhachSan}/images`)
      .set('Authorization', `Bearer ${token}`)
      .send({ image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUAg1WvHmoAAAAASUVORK5CYII=' });
    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.data.AnhDaiDien).toBe(true);
    expect(CloudinaryIntegration.uploadImage).toHaveBeenCalled();

    const deleteRes = await request(app)
      .delete(`/api/owner/hotels/${hotel.MaKhachSan}/images/${uploadRes.body.data.MaHinhAnh}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);
    expect(CloudinaryIntegration.deleteImage).toHaveBeenCalled();
  });

  it('rejects uploading an image to a hotel owned by someone else', async () => {
    const ownerA = await makeOwner();
    const ownerB = await makeOwner();
    const diaPhuong = await createTestDiaPhuong();
    diaPhuongIds.push(diaPhuong.MaDiaPhuong);
    const hotel = await createTestHotel(ownerA.account.MaTaiKhoan, diaPhuong.MaDiaPhuong);
    hotelIds.push(hotel.MaKhachSan);

    const res = await request(app)
      .post(`/api/owner/hotels/${hotel.MaKhachSan}/images`)
      .set('Authorization', `Bearer ${ownerB.token}`)
      .send({ image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUAg1WvHmoAAAAASUVORK5CYII=' });
    expect(res.status).toBe(403);
  });
});
