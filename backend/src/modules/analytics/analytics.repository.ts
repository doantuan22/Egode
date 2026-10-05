import { getPrismaClient } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { BOOKING_STATUS, ROOM_RATE_STATUS } from '../../common/constants/hotel-status';
import { PAYMENT_STATUS, REFUND_STATUS } from '../../common/constants/payment';
import { businessInstantFilter } from './date-range';

const toNumber = (value: unknown): number => Number(value ?? 0);

/**
 * `to` is always treated as an EXCLUSIVE upper bound here (same half-open
 * [from, to) convention as enumerateNights/checkOut throughout the app —
 * see hotels/availability.ts) — callers (owner/admin analytics services)
 * convert a user-facing inclusive "to" date into the next calendar day
 * before calling any method on this repository.
 */
export interface AnalyticsScope {
  /** Restricts every query to one hotel's bookings/rooms — omitted for admin's system-wide view. */
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
  /** null when there is no QUY_PHONG_GIA data at all in scope — 0% would misleadingly imply "configured but unsold". */
  TyLeLapDay: number | null;
}

export class AnalyticsRepository {
  /**
   * Booking counts are attributed by NgayTao (when the booking was made) —
   * the natural "activity in this period" reading, and the same field M6's
   * timeout sweep already treats as the booking's transaction timestamp.
   */
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

  /**
   * Revenue is attributed by ThoiGianGiaoDich (when the money actually moved)
   * — NOT booking status or booking date. A cancelled-without-payment
   * booking contributes nothing (no "Thành công" THANH_TOAN row exists for
   * it); a failed payment attempt is excluded by the TrangThai filter
   * itself. This is why "không tính booking hủy/thanh toán thất bại" needs
   * no special-case: querying THANH_TOAN by its own status is already exact.
   */
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

  /** Same attribution logic as payments, but by NgayHoanTien (when the refund actually completed) — see M8 report §2 for why this is what "refund được phản ánh đúng" means here. */
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

  /** Ranked by total rooms booked (SUM of CHI_TIET_DAT_PHONG.SoLuongPhong) — cancelled bookings excluded, same NgayTao attribution as countBookingsByStatus. */
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

  /**
   * Occupancy = booked room-nights / sellable room-nights, computed exactly
   * (not estimated) by clipping every overlapping booking's stay to
   * [from, to) in application code — the same technique
   * hotels/availability.ts uses for a single room type's availability,
   * generalized across every room type in scope. No new schema needed: it
   * only reads QUY_PHONG_GIA.SoLuongPhong and CHI_TIET_DAT_PHONG, both
   * already exact per-night sources of truth.
   */
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
      TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE,
      ...(scope.from || scope.to
        ? { NgayApDung: { ...(scope.from ? { gte: scope.from } : {}), ...(scope.to ? { lt: scope.to } : {}) } }
        : {}),
    };
    const rates = await prisma.qUY_PHONG_GIA.findMany({ where: rateWhere, select: { SoLuongPhong: true } });
    const tongPhongCoTheBan = rates.reduce((sum, r) => sum + r.SoLuongPhong, 0);
    if (tongPhongCoTheBan === 0) return { TongPhongDem: 0, TongPhongCoTheBan: 0, TyLeLapDay: null };

    const lines = await prisma.cHI_TIET_DAT_PHONG.findMany({
      where: {
        MaLoaiPhong: { in: roomTypeIds },
        DAT_PHONG: {
          TrangThai: { not: BOOKING_STATUS.CANCELLED },
          ...(scope.to ? { NgayNhanPhong: { lt: scope.to } } : {}),
          ...(scope.from ? { NgayTraPhong: { gt: scope.from } } : {}),
        },
      },
      select: { SoLuongPhong: true, DAT_PHONG: { select: { NgayNhanPhong: true, NgayTraPhong: true } } },
    });

    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    let tongPhongDem = 0;
    for (const line of lines) {
      const start = scope.from && scope.from > line.DAT_PHONG.NgayNhanPhong ? scope.from : line.DAT_PHONG.NgayNhanPhong;
      const end = scope.to && scope.to < line.DAT_PHONG.NgayTraPhong ? scope.to : line.DAT_PHONG.NgayTraPhong;
      const nights = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
      if (nights > 0) tongPhongDem += nights * line.SoLuongPhong;
    }

    return {
      TongPhongDem: tongPhongDem,
      TongPhongCoTheBan: tongPhongCoTheBan,
      TyLeLapDay: Math.round((tongPhongDem / tongPhongCoTheBan) * 10000) / 100,
    };
  }
}
