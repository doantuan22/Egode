import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  createTestAccount,
  createTestAmenity,
  createTestDiaPhuong,
  createTestHotel,
  deleteTestAccount,
  deleteTestAmenity,
  deleteTestDiaPhuong,
  deleteTestHotel,
} from '../../test/factories';
import { ROLE_NAMES } from '../../common/constants/roles';
import { HOTEL_STATUS } from '../../common/constants/hotel-status';
import { getPrismaClient } from '../../config/prisma';

const accountIds: number[] = [];
const hotelIds: number[] = [];
const locationIds: number[] = [];
const amenityIds: number[] = [];
let adminToken = '';
let ownerToken = '';
let ownerId = 0;
let locationId = 0;
const tokenFor = async (email: string, password: string) =>
  (await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password })).body.data.accessToken as string;
const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${adminToken}`);
const suffix = () => `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

beforeAll(async () => {
  const [admin, owner] = await Promise.all([createTestAccount({ role: ROLE_NAMES.ADMIN }), createTestAccount({ role: ROLE_NAMES.PARTNER })]);
  accountIds.push(admin.account.MaTaiKhoan, owner.account.MaTaiKhoan);
  ownerId = owner.account.MaTaiKhoan;
  [adminToken, ownerToken] = await Promise.all([tokenFor(admin.account.Email, admin.plainPassword), tokenFor(owner.account.Email, owner.plainPassword)]);
  const location = await createTestDiaPhuong();
  locationId = location.MaDiaPhuong;
  locationIds.push(locationId);
});

afterAll(async () => {
  await Promise.all(hotelIds.map(deleteTestHotel));
  await Promise.all(amenityIds.map(deleteTestAmenity));
  await Promise.all(accountIds.map(deleteTestAccount));
  await Promise.all(locationIds.map(deleteTestDiaPhuong));
});

describe('admin amenity catalogue', () => {
  it('is closed to anonymous callers and to owners', async () => {
    expect((await request(app).get('/api/admin/hotels/amenities')).status).toBe(401);
    expect((await request(app).get('/api/admin/hotels/amenities').set('Authorization', `Bearer ${ownerToken}`)).status).toBe(403);
    expect((await request(app).post('/api/admin/hotels/amenities').set('Authorization', `Bearer ${ownerToken}`).send({ TenTienNghi: 'Nope' })).status).toBe(403);
  });

  it('creates, lists, renames and deletes an amenity', async () => {
    const name = `Tiện nghi thử ${suffix()}`;
    const created = await asAdmin(request(app).post('/api/admin/hotels/amenities')).send({ TenTienNghi: `  ${name}  `, BieuTuong: 'wifi' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ TenTienNghi: name, BieuTuong: 'wifi' });
    const id = created.body.data.MaTienNghi as number;
    amenityIds.push(id);

    const list = await asAdmin(request(app).get('/api/admin/hotels/amenities'));
    expect(list.status).toBe(200);
    expect(list.body.data.find((a: { MaTienNghi: number }) => a.MaTienNghi === id)).toMatchObject({ SoKhachSan: 0, SoLoaiPhong: 0 });

    const renamed = await asAdmin(request(app).patch(`/api/admin/hotels/amenities/${id}`)).send({ TenTienNghi: `${name} v2`, BieuTuong: null });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data).toMatchObject({ TenTienNghi: `${name} v2`, BieuTuong: null });

    expect((await asAdmin(request(app).delete(`/api/admin/hotels/amenities/${id}`))).status).toBe(200);
    amenityIds.splice(amenityIds.indexOf(id), 1);
    expect(await getPrismaClient().tIEN_NGHI.findUnique({ where: { MaTienNghi: id } })).toBeNull();
  });

  it('rejects a duplicate name on create and on rename, but allows saving an amenity under its own name', async () => {
    const existing = await createTestAmenity();
    amenityIds.push(existing.MaTienNghi);
    const other = await createTestAmenity();
    amenityIds.push(other.MaTienNghi);

    expect((await asAdmin(request(app).post('/api/admin/hotels/amenities')).send({ TenTienNghi: existing.TenTienNghi })).status).toBe(409);
    expect((await asAdmin(request(app).patch(`/api/admin/hotels/amenities/${other.MaTienNghi}`)).send({ TenTienNghi: existing.TenTienNghi })).status).toBe(409);
    expect((await asAdmin(request(app).patch(`/api/admin/hotels/amenities/${existing.MaTienNghi}`)).send({ TenTienNghi: existing.TenTienNghi, BieuTuong: 'pool' })).status).toBe(200);
  });

  it('validates input and 404s on unknown ids', async () => {
    expect((await asAdmin(request(app).post('/api/admin/hotels/amenities')).send({ TenTienNghi: ' ' })).status).toBe(400);
    expect((await asAdmin(request(app).patch('/api/admin/hotels/amenities/999999999')).send({ TenTienNghi: 'Không tồn tại' })).status).toBe(404);
    expect((await asAdmin(request(app).delete('/api/admin/hotels/amenities/999999999'))).status).toBe(404);
    const amenity = await createTestAmenity();
    amenityIds.push(amenity.MaTienNghi);
    expect((await asAdmin(request(app).patch(`/api/admin/hotels/amenities/${amenity.MaTienNghi}`)).send({})).status).toBe(400);
  });

  it('refuses to delete an amenity that a hotel still lists, and reports the usage', async () => {
    const hotel = await createTestHotel(ownerId, locationId, { status: HOTEL_STATUS.ACTIVE });
    hotelIds.push(hotel.MaKhachSan);
    const amenity = await createTestAmenity();
    amenityIds.push(amenity.MaTienNghi);
    await getPrismaClient().kHACH_SAN_TIEN_NGHI.create({ data: { MaKhachSan: hotel.MaKhachSan, MaTienNghi: amenity.MaTienNghi } });

    const list = await asAdmin(request(app).get('/api/admin/hotels/amenities'));
    expect(list.body.data.find((a: { MaTienNghi: number }) => a.MaTienNghi === amenity.MaTienNghi).SoKhachSan).toBe(1);

    const blocked = await asAdmin(request(app).delete(`/api/admin/hotels/amenities/${amenity.MaTienNghi}`));
    expect(blocked.status).toBe(409);
    expect(await getPrismaClient().tIEN_NGHI.findUnique({ where: { MaTienNghi: amenity.MaTienNghi } })).not.toBeNull();
  });
});
