import { getPrismaClient } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { BOOKING_STATUS } from '../../common/constants/hotel-status';
import { PAYMENT_STATUS, REFUND_STATUS } from '../../common/constants/payment';
import { enumerateNights, toDateKey } from '../hotels/availability';
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
   * Occupancy = room-nights sold / room-nights in stock × 100, both counted per (room type, night) from the SAME
   * rows so the rate can never exceed 100 %:
   *
   *  - denominator: SoLuongPhong of every QUY_PHONG_GIA row of the hotel's room types in the range, whatever its
   *    status — a night closed for sale still had its rooms, and leaving it out would erase history (and shrink the
   *    denominator below what was really sold);
   *  - numerator: rooms of "Đã xác nhận" and "Hoàn tất" bookings on each night of the range that HAS such a row,
   *    capped at that night's SoLuongPhong. "Chờ thanh toán" (not sold yet) and "Đã hủy" never count; a night with
   *    no stock row has nothing to be a share of; a night recorded as overbooked in old data counts as full, not
   *    as more than full. Stored data is never altered to get there.
   * Computed in application code, exactly, with no estimate. Returns null (not 0 %) when there is no stock at all.
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
      ...(scope.from || scope.to
        ? { NgayApDung: { ...(scope.from ? { gte: scope.from } : {}), ...(scope.to ? { lt: scope.to } : {}) } }
        : {}),
    };
    const rates = await prisma.qUY_PHONG_GIA.findMany({ where: rateWhere, select: { MaLoaiPhong: true, NgayApDung: true, SoLuongPhong: true } });
    const stock = new Map<string, number>(); // "roomType|night" -> rooms in stock
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

    const booked = new Map<string, number>(); // same keys as `stock`
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
