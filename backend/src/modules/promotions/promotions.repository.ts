import { getPrismaClient } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { BOOKING_STATUS } from '../../common/constants/hotel-status';
import type { ListPromotionsQuery } from './promotions.schemas';

export interface PromotionWriteData {
  MaCode: string;
  LoaiGiamGia: string;
  GiaTriGiam: number;
  GiaTriDonToiThieu: number;
  MucGiamToiDa: number;
  SoLuongGioiHan: number;
  NgayBatDau: Date;
  NgayKetThuc: Date;
}

export class PromotionsRepository {
  async list(query: ListPromotionsQuery) {
    const prisma = getPrismaClient();
    const where: Prisma.KHUYEN_MAIWhereInput = {
      ...(query.TrangThai ? { TrangThai: query.TrangThai } : {}),
      ...(query.LoaiGiamGia ? { LoaiGiamGia: query.LoaiGiamGia } : {}),
      ...(query.search ? { MaCode: { contains: query.search } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.kHUYEN_MAI.findMany({
        where,
        orderBy: { MaKhuyenMai: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.kHUYEN_MAI.count({ where }),
    ]);

    return { items, total };
  }

  async findById(maKhuyenMai: number) {
    const prisma = getPrismaClient();
    return prisma.kHUYEN_MAI.findUnique({ where: { MaKhuyenMai: maKhuyenMai } });
  }

  async findByCode(maCode: string) {
    const prisma = getPrismaClient();
    return prisma.kHUYEN_MAI.findUnique({ where: { MaCode: maCode } });
  }

  /** Số đơn chưa hủy đã dùng mã này */
  async countUsage(maKhuyenMai: number): Promise<number> {
    const prisma = getPrismaClient();
    return prisma.dAT_PHONG.count({ where: { MaKhuyenMai: maKhuyenMai, TrangThai: { not: BOOKING_STATUS.CANCELLED } } });
  }

  /** Số đơn chưa hủy theo từng khuyến mãi */
  async countUsageByIds(maKhuyenMais: number[]): Promise<Map<number, number>> {
    if (maKhuyenMais.length === 0) return new Map();
    const prisma = getPrismaClient();
    const rows = await prisma.dAT_PHONG.groupBy({
      by: ['MaKhuyenMai'],
      where: { MaKhuyenMai: { in: maKhuyenMais }, TrangThai: { not: BOOKING_STATUS.CANCELLED } },
      _count: { _all: true },
    });
    return new Map(rows.flatMap((row) => (row.MaKhuyenMai === null ? [] : [[row.MaKhuyenMai, row._count._all] as const])));
  }

  /** Khuyến mãi hoạt động có khoảng ngày chứa ngày cho trước */
  async findActiveOnDay(dayKey: string, activeStatus: string) {
    const prisma = getPrismaClient();
    const day = new Date(`${dayKey}T00:00:00.000Z`);
    return prisma.kHUYEN_MAI.findMany({
      where: { TrangThai: activeStatus, NgayBatDau: { lte: day }, NgayKetThuc: { gte: day } },
      orderBy: [{ NgayKetThuc: 'asc' }, { MaKhuyenMai: 'asc' }],
    });
  }

  async create(data: PromotionWriteData & { PhamViApDung: string; TrangThai: string }) {
    const prisma = getPrismaClient();
    return prisma.kHUYEN_MAI.create({ data });
  }

  async update(maKhuyenMai: number, data: Partial<PromotionWriteData>) {
    const prisma = getPrismaClient();
    return prisma.kHUYEN_MAI.update({ where: { MaKhuyenMai: maKhuyenMai }, data });
  }

  async setStatus(maKhuyenMai: number, trangThai: string) {
    const prisma = getPrismaClient();
    return prisma.kHUYEN_MAI.update({ where: { MaKhuyenMai: maKhuyenMai }, data: { TrangThai: trangThai } });
  }
}
