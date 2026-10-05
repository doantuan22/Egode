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

/**
 * Admin-only aggregates that sit outside the owner/admin-shared
 * AnalyticsRepository (booking/revenue/room-type/occupancy) — system-wide
 * counts that have no per-hotel scope to begin with (accounts, hotels) or
 * that genuinely have no date column to range-filter on (DANH_GIA has no
 * NgayTao — see M8 report §3 for why review counts are reported as
 * all-time totals only, not "theo khoảng thời gian").
 */
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

  /** By ThoiGianGiaoDich — every attempt (Chờ xử lý/Thành công/Thất bại), not just successful ones (that total is analytics.repository's sumSuccessfulPayments). */
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

  /** By NgayYeuCau (when the refund was requested) — includes still-pending/failed ones, unlike sumSuccessfulRefunds. */
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

  /** All-time only — DANH_GIA has no created-date column, so there is nothing accurate to range-filter on. */
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
