import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { createTestPromotion, deleteTestPromotion } from '../../test/factories';
import { businessToday, addDaysToDateKey } from '../../common/utils/business-time';
import { PROMOTION_STATUS } from '../../common/constants/commercial';
import { PublicPromotionsService } from './public-promotions.service';
import type { PromotionsRepository } from './promotions.repository';

const ids: number[] = [];
const make = async (...args: Parameters<typeof createTestPromotion>) => {
  const promo = await createTestPromotion(...args);
  ids.push(promo.MaKhuyenMai);
  return promo;
};
const dayKey = (offset: number) => new Date(`${addDaysToDateKey(businessToday(), offset)}T00:00:00.000Z`);
const codesOf = async () => ((await request(app).get('/api/promotions/available')).body.data as Array<{ MaCode: string }>).map((p) => p.MaCode);

afterAll(async () => {
  await Promise.all(ids.map(deleteTestPromotion));
});

describe('GET /api/promotions/available', () => {
  it('is public and lists a promotion whose window contains today', async () => {
    const open = await make({ ngayBatDau: dayKey(-1), ngayKetThuc: dayKey(3), giaTriGiam: 15, giaTriDonToiThieu: 500000, mucGiamToiDa: 100000 });

    const res = await request(app).get('/api/promotions/available');
    expect(res.status).toBe(200);
    const item = res.body.data.find((p: { MaCode: string }) => p.MaCode === open.MaCode);
    expect(item).toEqual({
      MaCode: open.MaCode,
      LoaiGiamGia: open.LoaiGiamGia,
      GiaTriGiam: 15,
      GiaTriDonToiThieu: 500000,
      MucGiamToiDa: 100000,
      NgayBatDau: addDaysToDateKey(businessToday(), -1),
      NgayKetThuc: addDaysToDateKey(businessToday(), 3),
    });
  });

  it('includes a promotion on its first and on its last day', async () => {
    const startsToday = await make({ ngayBatDau: dayKey(0), ngayKetThuc: dayKey(5) });
    const endsToday = await make({ ngayBatDau: dayKey(-5), ngayKetThuc: dayKey(0) });

    const codes = await codesOf();
    expect(codes).toContain(startsToday.MaCode);
    expect(codes).toContain(endsToday.MaCode);
  });

  it('leaves out a promotion that has not started, one that has ended, and an inactive one', async () => {
    const future = await make({ ngayBatDau: dayKey(1), ngayKetThuc: dayKey(10) });
    const past = await make({ ngayBatDau: dayKey(-10), ngayKetThuc: dayKey(-1) });
    const inactive = await make({ ngayBatDau: dayKey(-1), ngayKetThuc: dayKey(10), trangThai: PROMOTION_STATUS.INACTIVE });

    const codes = await codesOf();
    expect(codes).not.toContain(future.MaCode);
    expect(codes).not.toContain(past.MaCode);
    expect(codes).not.toContain(inactive.MaCode);
  });

  it('never leaks usage counters or internal ids', async () => {
    await make({ ngayBatDau: dayKey(-1), ngayKetThuc: dayKey(10), soLuongGioiHan: 50 });
    const res = await request(app).get('/api/promotions/available');
    for (const item of res.body.data) {
      expect(Object.keys(item).sort()).toEqual(['GiaTriDonToiThieu', 'GiaTriGiam', 'LoaiGiamGia', 'MaCode', 'MucGiamToiDa', 'NgayBatDau', 'NgayKetThuc']);
    }
  });
});

describe('PublicPromotionsService usage cap', () => {
  const promo = (MaKhuyenMai: number, SoLuongGioiHan: number) => ({
    MaKhuyenMai,
    MaCode: `CODE${MaKhuyenMai}`,
    LoaiGiamGia: 'Phần trăm',
    GiaTriGiam: 10,
    GiaTriDonToiThieu: 0,
    MucGiamToiDa: 0,
    SoLuongGioiHan,
    NgayBatDau: new Date('2026-10-01T00:00:00.000Z'),
    NgayKetThuc: new Date('2026-10-31T00:00:00.000Z'),
    TrangThai: PROMOTION_STATUS.ACTIVE,
  });

  it('drops a code once its uses are used up and keeps unlimited / not-yet-full ones', async () => {
    const repository = {
      findActiveOnDay: async () => [promo(1, 2), promo(2, 0), promo(3, 5)],
      countUsageByIds: async () => new Map([[1, 2], [2, 40], [3, 4]]),
    } as unknown as PromotionsRepository;

    const list = await new PublicPromotionsService(repository).listAvailable(new Date('2026-10-13T03:00:00.000Z'));

    expect(list.map((p) => p.MaCode)).toEqual(['CODE2', 'CODE3']);
  });
});
