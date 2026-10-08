import { describe, it, expect, afterAll } from 'vitest';
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
} from '../../test/factories';
import { ROLE_NAMES } from '../../common/constants/roles';
import { getPrismaClient } from '../../config/prisma';

const accountIds: number[] = [];
const diaPhuongIds: number[] = [];
const hotelIds: number[] = [];

afterAll(async () => {
  await Promise.all(hotelIds.map((id) => deleteTestHotel(id)));
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await Promise.all(diaPhuongIds.map((id) => deleteTestDiaPhuong(id)));
});

const loginAndGetToken = async (email: string, password: string) => {
  const res = await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password });
  return res.body.data.accessToken as string;
};

const makeOwnerWithRoomType = async () => {
  const { account, plainPassword } = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  accountIds.push(account.MaTaiKhoan);
  const token = await loginAndGetToken(account.Email, plainPassword);
  const diaPhuong = await createTestDiaPhuong();
  diaPhuongIds.push(diaPhuong.MaDiaPhuong);
  const hotel = await createTestHotel(account.MaTaiKhoan, diaPhuong.MaDiaPhuong);
  hotelIds.push(hotel.MaKhachSan);
  const roomType = await createTestRoomType(hotel.MaKhachSan);
  return { account, token, hotel, roomType };
};

const addDays = (days: number): string => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

describe('PUT /api/owner/room-types/:id/rates (bulk create/update)', () => {
  it('creates rates for a date range and they are readable via GET', async () => {
    const { token, roomType } = await makeOwnerWithRoomType();

    const putRes = await request(app)
      .put(`/api/owner/room-types/${roomType.MaLoaiPhong}/rates`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        rates: [
          { NgayApDung: addDays(30), GiaPhong: 500000, SoLuongPhong: 5 },
          { NgayApDung: addDays(31), GiaPhong: 550000, SoLuongPhong: 5 },
        ],
      });
    expect(putRes.status).toBe(200);
    expect(putRes.body.data).toHaveLength(2);

    const getRes = await request(app)
      .get(`/api/owner/room-types/${roomType.MaLoaiPhong}/rates`)
      .query({ from: addDays(30), to: addDays(31) })
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data).toHaveLength(2);
  });

  it('updates existing rates in place instead of creating duplicates', async () => {
    const { token, roomType } = await makeOwnerWithRoomType();
    const date = addDays(40);

    await request(app)
      .put(`/api/owner/room-types/${roomType.MaLoaiPhong}/rates`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rates: [{ NgayApDung: date, GiaPhong: 400000, SoLuongPhong: 3 }] });

    const secondRes = await request(app)
      .put(`/api/owner/room-types/${roomType.MaLoaiPhong}/rates`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rates: [{ NgayApDung: date, GiaPhong: 480000, SoLuongPhong: 4 }] });
    expect(secondRes.status).toBe(200);

    const prisma = getPrismaClient();
    const rows = await prisma.qUY_PHONG_GIA.findMany({
      where: { MaLoaiPhong: roomType.MaLoaiPhong, NgayApDung: new Date(`${date}T00:00:00.000Z`) },
    });
    expect(rows).toHaveLength(1); // no duplicate (MaLoaiPhong, NgayApDung) row
    expect(Number(rows[0].GiaPhong)).toBe(480000);
    expect(rows[0].SoLuongPhong).toBe(4);
  });

  it('changes only the status when price and quantity are omitted, keeping the stored values', async () => {
    const { token, roomType } = await makeOwnerWithRoomType();
    const dates = [addDays(50), addDays(51)];
    const put = (rates: unknown[]) =>
      request(app).put(`/api/owner/room-types/${roomType.MaLoaiPhong}/rates`).set('Authorization', `Bearer ${token}`).send({ rates });

    expect((await put(dates.map((d) => ({ NgayApDung: d, GiaPhong: 610000, SoLuongPhong: 7 })))).status).toBe(200);
    const closeRes = await put(dates.map((d) => ({ NgayApDung: d, TrangThai: 'Đóng bán' })));
    expect(closeRes.status).toBe(200);

    const rows = await getPrismaClient().qUY_PHONG_GIA.findMany({ where: { MaLoaiPhong: roomType.MaLoaiPhong } });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.TrangThai).toBe('Đóng bán');
      expect(Number(row.GiaPhong)).toBe(610000);
      expect(row.SoLuongPhong).toBe(7);
    }

    // price only: the quantity of the day is kept
    expect((await put([{ NgayApDung: dates[0], GiaPhong: 650000, TrangThai: 'Mở bán' }])).status).toBe(200);
    const first = await getPrismaClient().qUY_PHONG_GIA.findFirstOrThrow({
      where: { MaLoaiPhong: roomType.MaLoaiPhong, NgayApDung: new Date(`${dates[0]}T00:00:00.000Z`) },
    });
    expect(Number(first.GiaPhong)).toBe(650000);
    expect(first.SoLuongPhong).toBe(7);
    expect(first.TrangThai).toBe('Mở bán');
  });

  it('rejects a status-only change for a day that has no rate row yet (400) and writes nothing', async () => {
    const { token, roomType } = await makeOwnerWithRoomType();
    const date = addDays(60);

    const res = await request(app)
      .put(`/api/owner/room-types/${roomType.MaLoaiPhong}/rates`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rates: [{ NgayApDung: date, TrangThai: 'Đóng bán' }] });
    expect(res.status).toBe(400);

    const rows = await getPrismaClient().qUY_PHONG_GIA.findMany({ where: { MaLoaiPhong: roomType.MaLoaiPhong } });
    expect(rows).toHaveLength(0);
  });

  it('rejects duplicate (MaLoaiPhong, NgayApDung) within the same bulk request', async () => {
    const { token, roomType } = await makeOwnerWithRoomType();
    const date = addDays(50);

    const res = await request(app)
      .put(`/api/owner/room-types/${roomType.MaLoaiPhong}/rates`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        rates: [
          { NgayApDung: date, GiaPhong: 500000, SoLuongPhong: 5 },
          { NgayApDung: date, GiaPhong: 600000, SoLuongPhong: 6 },
        ],
      });
    expect(res.status).toBe(400);
  });

  it('rejects negative GiaPhong', async () => {
    const { token, roomType } = await makeOwnerWithRoomType();
    const res = await request(app)
      .put(`/api/owner/room-types/${roomType.MaLoaiPhong}/rates`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rates: [{ NgayApDung: addDays(60), GiaPhong: -1000, SoLuongPhong: 5 }] });
    expect(res.status).toBe(400);
  });

  it('rejects negative SoLuongPhong', async () => {
    const { token, roomType } = await makeOwnerWithRoomType();
    const res = await request(app)
      .put(`/api/owner/room-types/${roomType.MaLoaiPhong}/rates`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rates: [{ NgayApDung: addDays(60), GiaPhong: 500000, SoLuongPhong: -1 }] });
    expect(res.status).toBe(400);
  });

  it('rejects cross-owner access to rates (403)', async () => {
    const ownerA = await makeOwnerWithRoomType();
    const ownerB = await makeOwnerWithRoomType();

    const getRes = await request(app)
      .get(`/api/owner/room-types/${ownerA.roomType.MaLoaiPhong}/rates`)
      .query({ from: addDays(30), to: addDays(31) })
      .set('Authorization', `Bearer ${ownerB.token}`);
    expect(getRes.status).toBe(403);

    const putRes = await request(app)
      .put(`/api/owner/room-types/${ownerA.roomType.MaLoaiPhong}/rates`)
      .set('Authorization', `Bearer ${ownerB.token}`)
      .send({ rates: [{ NgayApDung: addDays(30), GiaPhong: 1, SoLuongPhong: 1 }] });
    expect(putRes.status).toBe(403);
  });
});

describe('M2 availability regression: owner rate updates must be reflected correctly', () => {
  it('public /api/hotels/:id/rooms reflects price/quantity set via the owner API, and stays consistent after an update', async () => {
    const { token, hotel, roomType } = await makeOwnerWithRoomType();
    // The hotel factory defaults to TrangThai='Hoạt động' so it is visible
    // to the public M2 endpoints without needing admin approval here.
    const checkIn = addDays(70);
    const checkOut = addDays(72); // 2 nights

    await request(app)
      .put(`/api/owner/room-types/${roomType.MaLoaiPhong}/rates`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        rates: [
          { NgayApDung: checkIn, GiaPhong: 700000, SoLuongPhong: 4 },
          { NgayApDung: addDays(71), GiaPhong: 700000, SoLuongPhong: 4 },
        ],
      });

    const publicRes = await request(app)
      .get(`/api/hotels/${hotel.MaKhachSan}/rooms`)
      .query({ checkIn, checkOut });
    expect(publicRes.status).toBe(200);
    const room = publicRes.body.data.find((r: { MaLoaiPhong: number }) => r.MaLoaiPhong === roomType.MaLoaiPhong);
    expect(room.SoPhongConLai).toBe(4);
    expect(room.GiaTheoDem).toBe(700000);
    expect(room.ConHang).toBe(true);

    // Owner lowers quantity to 0 (closes out inventory) — public availability must follow.
    await request(app)
      .put(`/api/owner/room-types/${roomType.MaLoaiPhong}/rates`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        rates: [
          { NgayApDung: checkIn, GiaPhong: 700000, SoLuongPhong: 0 },
          { NgayApDung: addDays(71), GiaPhong: 700000, SoLuongPhong: 0 },
        ],
      });

    const publicRes2 = await request(app)
      .get(`/api/hotels/${hotel.MaKhachSan}/rooms`)
      .query({ checkIn, checkOut });
    const room2 = publicRes2.body.data.find((r: { MaLoaiPhong: number }) => r.MaLoaiPhong === roomType.MaLoaiPhong);
    expect(room2.SoPhongConLai).toBe(0);
    expect(room2.ConHang).toBe(false);
  });
});
