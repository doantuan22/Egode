import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { createTestAccount, createTestDiaPhuong, createTestHotel, deleteTestAccount, deleteTestDiaPhuong, deleteTestHotel } from '../../test/factories';
import { getPrismaClient } from '../../config/prisma';
import { ROLE_NAMES } from '../../common/constants/roles';
import { HHMM_PATTERN, timeOfDayJsonReplacer } from '../../common/utils/time-of-day';

/**
 * Bug #19 — GioNhanPhong / GioTraPhong are "HH:mm" for admin and owner alike: the same accepted values, the same
 * rejected values, the same message, and the same representation in every response (not 1970-01-01T…Z).
 */
const accountIds: number[] = [];
let diaPhuongId = 0;
let hotelId = 0;
let ownerToken = '';
let adminToken = '';
const prisma = () => getPrismaClient();
const login = async (email: string, password: string) =>
  (await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password })).body.data.accessToken as string;

beforeAll(async () => {
  const [owner, admin] = await Promise.all([createTestAccount({ role: ROLE_NAMES.PARTNER }), createTestAccount({ role: ROLE_NAMES.ADMIN })]);
  accountIds.push(owner.account.MaTaiKhoan, admin.account.MaTaiKhoan);
  [ownerToken, adminToken] = await Promise.all([login(owner.account.Email, owner.plainPassword), login(admin.account.Email, admin.plainPassword)]);
  diaPhuongId = (await createTestDiaPhuong()).MaDiaPhuong;
  hotelId = (await createTestHotel(owner.account.MaTaiKhoan, diaPhuongId)).MaKhachSan;
});

afterAll(async () => {
  await deleteTestHotel(hotelId);
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await deleteTestDiaPhuong(diaPhuongId);
});

type Role = 'admin' | 'owner';
const patch = (role: Role, body: object) =>
  request(app)
    .patch(role === 'admin' ? `/api/admin/hotels/${hotelId}` : `/api/owner/hotels/${hotelId}`)
    .set('Authorization', `Bearer ${role === 'admin' ? adminToken : ownerToken}`)
    .send(body);
const stored = async () => {
  const row = await prisma().kHACH_SAN.findUniqueOrThrow({ where: { MaKhachSan: hotelId } });
  return { in: row.GioNhanPhong.toISOString().slice(11, 16), out: row.GioTraPhong.toISOString().slice(11, 16) };
};

describe.each<Role>(['admin', 'owner'])('%s PATCH hotel — check-in / check-out time', (role) => {
  it.each(['14:00', '02:30', '00:00', '23:59', '09:05'])('accepts "%s" and stores exactly that time', async (value) => {
    const res = await patch(role, { GioNhanPhong: value, GioTraPhong: value });
    expect(res.status).toBe(200);
    expect(await stored()).toEqual({ in: value, out: value });
    // the response shows the same "HH:mm", never a 1970 timestamp
    expect(res.body.data.GioNhanPhong).toBe(value);
    expect(res.body.data.GioTraPhong).toBe(value);
  });

  it.each(['25:00', '24:00', '14:70', '14:60', '7:00', '07:0', '14', '14:00:00', '1400', '14.00', ' 14:00', 'aa:bb', '', '1970-01-01T14:00:00Z', '2030-01-01'])(
    'rejects %j with 400 "Giờ phải theo định dạng HH:MM" and changes nothing',
    async (value) => {
      const before = await stored();
      const res = await patch(role, { GioNhanPhong: value });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details).toEqual([{ field: 'GioNhanPhong', message: 'Giờ phải theo định dạng HH:MM' }]);
      expect(await stored()).toEqual(before);
    }
  );

  it('rejects non-string values (numbers, null, objects, a Date-like number)', async () => {
    for (const value of [1400, null, {}, [], 1735689600000]) {
      const res = await patch(role, { GioTraPhong: value });
      expect(res.status, JSON.stringify(value)).toBe(400);
      expect(res.body.details[0].field).toBe('GioTraPhong');
    }
  });

  it('check-in and check-out are validated independently, each error naming its own field', async () => {
    const res = await patch(role, { GioNhanPhong: '25:00', GioTraPhong: '14:70' });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { field: string }) => d.field).sort()).toEqual(['GioNhanPhong', 'GioTraPhong']);
  });
});

describe('admin and owner speak the same contract', () => {
  it('the same value in, the same value out, from either role', async () => {
    const admin = await patch('admin', { GioNhanPhong: '15:30', GioTraPhong: '11:15' });
    const owner = await patch('owner', { GioNhanPhong: '15:30', GioTraPhong: '11:15' });

    expect(admin.status).toBe(200);
    expect(owner.status).toBe(200);
    expect([admin.body.data.GioNhanPhong, admin.body.data.GioTraPhong]).toEqual(['15:30', '11:15']);
    expect([owner.body.data.GioNhanPhong, owner.body.data.GioTraPhong]).toEqual(['15:30', '11:15']);
  });

  it('reads agree too: admin detail, owner detail and the public hotel page show the same "HH:mm"', async () => {
    await patch('admin', { GioNhanPhong: '13:45', GioTraPhong: '10:20' });
    const [adminView, ownerView, publicView] = await Promise.all([
      request(app).get(`/api/admin/hotels/${hotelId}`).set('Authorization', `Bearer ${adminToken}`),
      request(app).get(`/api/owner/hotels/${hotelId}`).set('Authorization', `Bearer ${ownerToken}`),
      request(app).get(`/api/hotels/${hotelId}`),
    ]);
    for (const view of [adminView, ownerView, publicView]) {
      expect(view.status).toBe(200);
      expect([view.body.data.GioNhanPhong, view.body.data.GioTraPhong]).toEqual(['13:45', '10:20']);
    }
  });

  it('the hotel list of each role shows it as "HH:mm" as well', async () => {
    const adminList = await request(app).get('/api/admin/hotels?limit=100').set('Authorization', `Bearer ${adminToken}`);
    const ownerList = await request(app).get('/api/owner/hotels').set('Authorization', `Bearer ${ownerToken}`);
    const inAdmin = adminList.body.data.find((h: { MaKhachSan: number }) => h.MaKhachSan === hotelId);
    const inOwner = ownerList.body.data.find((h: { MaKhachSan: number }) => h.MaKhachSan === hotelId);
    expect(inAdmin.GioNhanPhong).toMatch(HHMM_PATTERN);
    expect(inOwner.GioNhanPhong).toMatch(HHMM_PATTERN);
    expect(inAdmin.GioNhanPhong).toBe(inOwner.GioNhanPhong);
  });

  it('owner creating a hotel uses the same rule', async () => {
    const owner2 = await createTestAccount({ role: ROLE_NAMES.PARTNER });
    accountIds.push(owner2.account.MaTaiKhoan);
    const token = await login(owner2.account.Email, owner2.plainPassword);
    const create = (gio: string) =>
      request(app).post('/api/owner/hotels').set('Authorization', `Bearer ${token}`).send({ TenKhachSan: 'Hotel Times', DiaChiChiTiet: '1 Time Street', HangSao: 3, GioNhanPhong: gio, GioTraPhong: '12:00', MaDiaPhuong: diaPhuongId });
    expect((await create('25:00')).status).toBe(400);
    const ok = await create('02:30');
    expect(ok.status).toBe(201);
    expect(ok.body.data.GioNhanPhong).toBe('02:30');
    await deleteTestHotel(ok.body.data.MaKhachSan);
  });
});

describe('the response formatter only touches TIME columns', () => {
  it('rewrites a 1970 time-of-day for the two hotel fields', () => {
    expect(JSON.parse(JSON.stringify({ GioNhanPhong: new Date('1970-01-01T14:00:00Z'), GioTraPhong: new Date('1970-01-01T02:30:00Z') }, timeOfDayJsonReplacer))).toEqual({ GioNhanPhong: '14:00', GioTraPhong: '02:30' });
  });

  it('leaves everything else alone: other fields, real timestamps, and values already in HH:mm', () => {
    const body = { NgayTao: new Date('1970-01-01T14:00:00Z'), GioNhanPhong: '15:30', GioTraPhong: new Date('2030-06-01T05:00:00Z'), nested: { ThoiDiemNhanPhong: '2030-06-01T07:00:00.000Z' } };
    expect(JSON.parse(JSON.stringify(body, timeOfDayJsonReplacer))).toEqual({
      NgayTao: '1970-01-01T14:00:00.000Z',
      GioNhanPhong: '15:30',
      GioTraPhong: '2030-06-01T05:00:00.000Z',
      nested: { ThoiDiemNhanPhong: '2030-06-01T07:00:00.000Z' },
    });
  });
});
