import { getPrismaClient } from '../../config/prisma';
import { businessInstantFilter } from './date-range';

export interface CountByLabel {
  Label: string;
  SoLuong: number;
}

export interface AdminDateRange {
  from?: Date;
  to?: Date;
}

/** Thống kê toàn hệ thống dành riêng cho admin */
export class AdminAnalyticsRepository {
  async countAccountsByRole(): Promise<CountByLabel[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.tAI_KHOAN.groupBy({ by: ['MaVaiTro'], _count: { _all: true } });
    const roles = await prisma.vAI_TRO.findMany({ select: { MaVaiTro: true, TenVaiTro: true } });
    const nameById = new Map(roles.map((r) => [r.MaVaiTro, r.TenVaiTro]));
    return rows.map((r) => ({ Label: nameById.get(r.MaVaiTro) ?? `#${r.MaVaiTro}`, SoLuong: r._count._all }));
  }

  async countHotelsByStatus(): Promise<CountByLabel[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.kHACH_SAN.groupBy({ by: ['TrangThai'], _count: { _all: true } });
    return rows.map((r) => ({ Label: r.TrangThai, SoLuong: r._count._all }));
  }

  /** Tổng thanh toán theo thời điểm giao dịch, gồm mọi trạng thái */
  async countPaymentsByStatus(range: AdminDateRange): Promise<CountByLabel[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.tHANH_TOAN.groupBy({
      by: ['TrangThai'],
      where:
        range.from || range.to
          ? { ThoiGianGiaoDich: businessInstantFilter(range) }
          : {},
      _count: { _all: true },
    });
    return rows.map((r) => ({ Label: r.TrangThai, SoLuong: r._count._all }));
  }

  /** Tổng hoàn tiền theo ngày yêu cầu, gồm cả đang chờ và thất bại */
  async countRefundsByStatus(range: AdminDateRange): Promise<CountByLabel[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.hOAN_TIEN.groupBy({
      by: ['TrangThai'],
      where:
        range.from || range.to
          ? { NgayYeuCau: businessInstantFilter(range) }
          : {},
      _count: { _all: true },
    });
    return rows.map((r) => ({ Label: r.TrangThai, SoLuong: r._count._all }));
  }

  /** Số đánh giá toàn thời gian vì không có ngày tạo */
  async countReviewsByStatus(): Promise<CountByLabel[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.dANH_GIA.groupBy({ by: ['TrangThai'], _count: { _all: true } });
    return rows.map((r) => ({ Label: r.TrangThai, SoLuong: r._count._all }));
  }

  async countSupportByStatus(range: AdminDateRange): Promise<CountByLabel[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.yEU_CAU_HO_TRO.groupBy({
      by: ['TrangThai'],
      where:
        range.from || range.to ? { NgayTao: businessInstantFilter(range) } : {},
      _count: { _all: true },
    });
    return rows.map((r) => ({ Label: r.TrangThai, SoLuong: r._count._all }));
  }
}
