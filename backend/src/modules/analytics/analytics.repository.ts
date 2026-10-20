import { getPrismaClient } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { BOOKING_STATUS } from '../../common/constants/hotel-status';
import { PAYMENT_STATUS, REFUND_STATUS } from '../../common/constants/payment';
import { enumerateNights, toDateKey } from '../hotels/availability';
import { businessInstantFilter } from './date-range';

const toNumber = (value: unknown): number => Number(value ?? 0);

/** Ngày kết thúc luôn là cận trên loại trừ */
export interface AnalyticsScope {
  /** Giới hạn truy vấn theo một khách sạn */
  maKhachSan?: number;
  from?: Date;
  to?: Date;
}

export interface BookingsByStatus {
  TrangThai: string;
  SoLuong: number;
}

export interface TopRoomType {
  MaLoaiPhong: number;
  TenLoaiPhong: string;
  SoLuongDaDat: number;
}

export interface OccupancyResult {
  TongPhongDem: number;
  TongPhongCoTheBan: number;
  /** Trả null khi chưa có dữ liệu quỹ phòng */
  TyLeLapDay: number | null;
}

export class AnalyticsRepository {
  /** Đếm đơn theo ngày tạo */
  async countBookingsByStatus(scope: AnalyticsScope): Promise<BookingsByStatus[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.dAT_PHONG.groupBy({
      by: ['TrangThai'],
      where: {
        ...(scope.maKhachSan ? { MaKhachSan: scope.maKhachSan } : {}),
        ...(scope.from || scope.to
          ? { NgayTao: businessInstantFilter(scope) }
          : {}),
      },
      _count: { _all: true },
    });
    return rows.map((r) => ({ TrangThai: r.TrangThai, SoLuong: r._count._all }));
  }

  /** Doanh thu tính theo thời điểm giao dịch thành công */
  async sumSuccessfulPayments(scope: AnalyticsScope): Promise<number> {
    const prisma = getPrismaClient();
    const where: Prisma.THANH_TOANWhereInput = {
      TrangThai: PAYMENT_STATUS.SUCCESS,
      ...(scope.from || scope.to
        ? { ThoiGianGiaoDich: businessInstantFilter(scope) }
        : {}),
      ...(scope.maKhachSan ? { DAT_PHONG: { MaKhachSan: scope.maKhachSan } } : {}),
    };
    const agg = await prisma.tHANH_TOAN.aggregate({ where, _sum: { SoTien: true } });
    return toNumber(agg._sum.SoTien);
  }

  /** Hoàn tiền tính theo ngày hoàn tất */
  async sumSuccessfulRefunds(scope: AnalyticsScope): Promise<number> {
    const prisma = getPrismaClient();
    const where: Prisma.HOAN_TIENWhereInput = {
      TrangThai: REFUND_STATUS.SUCCESS,
      ...(scope.from || scope.to
        ? { NgayHoanTien: businessInstantFilter(scope) }
        : {}),
      ...(scope.maKhachSan ? { THANH_TOAN: { DAT_PHONG: { MaKhachSan: scope.maKhachSan } } } : {}),
    };
    const agg = await prisma.hOAN_TIEN.aggregate({ where, _sum: { SoTienHoan: true } });
    return toNumber(agg._sum.SoTienHoan);
  }

  /** Xếp hạng loại phòng theo tổng số phòng đã đặt */
  async topRoomTypes(scope: AnalyticsScope, limit = 5): Promise<TopRoomType[]> {
    const prisma = getPrismaClient();
    const grouped = await prisma.cHI_TIET_DAT_PHONG.groupBy({
      by: ['MaLoaiPhong'],
      where: {
        DAT_PHONG: {
          TrangThai: { not: BOOKING_STATUS.CANCELLED },
          ...(scope.maKhachSan ? { MaKhachSan: scope.maKhachSan } : {}),
          ...(scope.from || scope.to
            ? { NgayTao: businessInstantFilter(scope) }
            : {}),
        },
      },
      _sum: { SoLuongPhong: true },
      orderBy: { _sum: { SoLuongPhong: 'desc' } },
      take: limit,
    });
    if (grouped.length === 0) return [];

    const roomTypes = await prisma.lOAI_PHONG.findMany({
      where: { MaLoaiPhong: { in: grouped.map((g) => g.MaLoaiPhong) } },
      select: { MaLoaiPhong: true, TenLoaiPhong: true },
    });
    const nameById = new Map(roomTypes.map((r) => [r.MaLoaiPhong, r.TenLoaiPhong]));
    return grouped.map((g) => ({
      MaLoaiPhong: g.MaLoaiPhong,
      TenLoaiPhong: nameById.get(g.MaLoaiPhong) ?? '(đã xóa)',
      SoLuongDaDat: toNumber(g._sum.SoLuongPhong),
    }));
  }

  /** Công suất bằng số đêm phòng đã bán chia số đêm phòng tồn kho */
  async occupancy(scope: AnalyticsScope): Promise<OccupancyResult> {
    const prisma = getPrismaClient();
    const roomTypeIds = (
      await prisma.lOAI_PHONG.findMany({
        where: scope.maKhachSan ? { MaKhachSan: scope.maKhachSan } : {},
        select: { MaLoaiPhong: true },
      })
    ).map((r) => r.MaLoaiPhong);

    if (roomTypeIds.length === 0) return { TongPhongDem: 0, TongPhongCoTheBan: 0, TyLeLapDay: null };

    const rateWhere: Prisma.QUY_PHONG_GIAWhereInput = {
      MaLoaiPhong: { in: roomTypeIds },
      ...(scope.from || scope.to
        ? { NgayApDung: { ...(scope.from ? { gte: scope.from } : {}), ...(scope.to ? { lt: scope.to } : {}) } }
        : {}),
    };
    const rates = await prisma.qUY_PHONG_GIA.findMany({ where: rateWhere, select: { MaLoaiPhong: true, NgayApDung: true, SoLuongPhong: true } });
    const stock = new Map<string, number>();
    let tongPhongCoTheBan = 0;
    for (const rate of rates) {
      stock.set(`${rate.MaLoaiPhong}|${toDateKey(rate.NgayApDung)}`, rate.SoLuongPhong);
      tongPhongCoTheBan += rate.SoLuongPhong;
    }
    if (tongPhongCoTheBan === 0) return { TongPhongDem: 0, TongPhongCoTheBan: 0, TyLeLapDay: null };

    const lines = await prisma.cHI_TIET_DAT_PHONG.findMany({
      where: {
        MaLoaiPhong: { in: roomTypeIds },
        DAT_PHONG: {
          TrangThai: { in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED] },
          ...(scope.to ? { NgayNhanPhong: { lt: scope.to } } : {}),
          ...(scope.from ? { NgayTraPhong: { gt: scope.from } } : {}),
        },
      },
      select: { MaLoaiPhong: true, SoLuongPhong: true, DAT_PHONG: { select: { NgayNhanPhong: true, NgayTraPhong: true } } },
    });

    const booked = new Map<string, number>();
    for (const line of lines) {
      for (const night of enumerateNights(line.DAT_PHONG.NgayNhanPhong, line.DAT_PHONG.NgayTraPhong)) {
        const key = `${line.MaLoaiPhong}|${night}`;
        if (stock.has(key)) booked.set(key, (booked.get(key) ?? 0) + line.SoLuongPhong);
      }
    }
    let tongPhongDem = 0;
    for (const [key, rooms] of booked) tongPhongDem += Math.min(rooms, stock.get(key) ?? 0);

    return {
      TongPhongDem: tongPhongDem,
      TongPhongCoTheBan: tongPhongCoTheBan,
      TyLeLapDay: Math.round((tongPhongDem / tongPhongCoTheBan) * 10000) / 100,
    };
  }
}
