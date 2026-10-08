import { getPrismaClient } from '../../config/prisma';
import { Prisma } from '../../generated/prisma/client';
import { BOOKING_STATUS } from '../../common/constants/hotel-status';
import { AppError } from '../../common/errors/app-error';
import { expireStalePendingBookings } from '../bookings/booking-expiry';
import { buildBookedByDate, toDateKey } from '../hotels/availability';

export interface RateUpsertItem {
  NgayApDung: Date;
  /** Omitted = keep the stored price of that day. */
  GiaPhong?: number;
  /** Omitted = keep the stored room count of that day. */
  SoLuongPhong?: number;
  TrangThai: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class OwnerRatesRepository {
  async listForRoomType(maLoaiPhong: number, from: Date, to: Date) {
    const prisma = getPrismaClient();
    return prisma.qUY_PHONG_GIA.findMany({
      where: { MaLoaiPhong: maLoaiPhong, NgayApDung: { gte: from, lte: to } },
      orderBy: { NgayApDung: 'asc' },
    });
  }

  /**
   * Upserts each row against UQ_QUY_PHONG_GIA_MaLoaiPhong_NgayApDung — never creates a duplicate — but only if no
   * night ends up with fewer rooms than are already booked for it.
   *
   * The whole check-and-write is one transaction that first takes the SAME lock a booking takes
   * (QUY_PHONG_GIA WITH UPDLOCK, HOLDLOCK over the room type and date range, which also covers dates that have no
   * row yet). A booking being created at the same moment therefore either commits first — and is counted below —
   * or waits until this update commits and then sees the new quantity. Lock order is the booking's own order
   * (rates first), so the two cannot deadlock.
   *
   * An item may omit GiaPhong and/or SoLuongPhong to change only the status: the stored value of that day is kept
   * (and an unchanged room count cannot conflict with bookings). A day with no row yet needs both to be created.
   */
  async bulkUpsertGuarded(maLoaiPhong: number, items: RateUpsertItem[]) {
    const prisma = getPrismaClient();
    const days = items.map((i) => Date.UTC(i.NgayApDung.getUTCFullYear(), i.NgayApDung.getUTCMonth(), i.NgayApDung.getUTCDate()));
    const first = new Date(Math.min(...days));
    const last = new Date(Math.max(...days));
    const dayAfterLast = new Date(last.getTime() + MS_PER_DAY);

    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT MaQuyPhong FROM QUY_PHONG_GIA WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE MaLoaiPhong = ${maLoaiPhong} AND NgayApDung >= ${first} AND NgayApDung < ${dayAfterLast}
      `);
      // An expired unpaid hold no longer occupies a room, so it must not block a reduction either.
      await expireStalePendingBookings(tx);

      const lines = await tx.cHI_TIET_DAT_PHONG.findMany({
        where: {
          MaLoaiPhong: maLoaiPhong,
          DAT_PHONG: { TrangThai: { not: BOOKING_STATUS.CANCELLED }, NgayNhanPhong: { lt: dayAfterLast }, NgayTraPhong: { gt: first } },
        },
        select: { SoLuongPhong: true, DAT_PHONG: { select: { NgayNhanPhong: true, NgayTraPhong: true } } },
      });
      const booked = buildBookedByDate(
        lines.map((l) => ({ ngayNhanPhong: l.DAT_PHONG.NgayNhanPhong, ngayTraPhong: l.DAT_PHONG.NgayTraPhong, soLuongPhong: l.SoLuongPhong }))
      );

      const partial = items.filter((item) => item.GiaPhong === undefined || item.SoLuongPhong === undefined);
      if (partial.length > 0) {
        const existing = await tx.qUY_PHONG_GIA.findMany({
          where: { MaLoaiPhong: maLoaiPhong, NgayApDung: { in: partial.map((item) => item.NgayApDung) } },
          select: { NgayApDung: true },
        });
        const have = new Set(existing.map((row) => toDateKey(row.NgayApDung)));
        const missing = partial.map((item) => toDateKey(item.NgayApDung)).filter((key) => !have.has(key)).sort();
        if (missing.length > 0) {
          throw AppError.badRequest(
            `Ngày ${missing[0]}${missing.length > 1 ? ` và ${missing.length - 1} ngày khác` : ''} chưa có giá/quỹ phòng: cần nhập cả giá và số lượng để tạo mới`,
            missing.map((key) => ({ field: `NgayApDung:${key}`, message: 'Chưa có giá/quỹ phòng, cần nhập giá và số lượng' }))
          );
        }
      }

      const conflicts = items
        .flatMap((item) =>
          item.SoLuongPhong === undefined
            ? []
            : [{ date: toDateKey(item.NgayApDung), booked: booked.get(toDateKey(item.NgayApDung)) ?? 0, requested: item.SoLuongPhong }]
        )
        .filter((c) => c.requested < c.booked)
        .sort((a, b) => a.date.localeCompare(b.date));
      if (conflicts.length > 0) {
        const worst = conflicts[0];
        throw AppError.conflict(
          `Không thể giảm số phòng xuống ${worst.requested} vào ngày ${worst.date}: đã có ${worst.booked} phòng được đặt${conflicts.length > 1 ? ` (và ${conflicts.length - 1} ngày khác)` : ''}`,
          conflicts.map((c) => ({ field: `NgayApDung:${c.date}`, message: `Đã có ${c.booked} phòng được đặt, không thể đặt số phòng là ${c.requested}` }))
        );
      }

      const saved = [];
      for (const item of items) {
        saved.push(
          await tx.qUY_PHONG_GIA.upsert({
            where: { MaLoaiPhong_NgayApDung: { MaLoaiPhong: maLoaiPhong, NgayApDung: item.NgayApDung } },
            update: {
              ...(item.GiaPhong === undefined ? {} : { GiaPhong: item.GiaPhong }),
              ...(item.SoLuongPhong === undefined ? {} : { SoLuongPhong: item.SoLuongPhong }),
              TrangThai: item.TrangThai,
            },
            // Both are present here: a day without a row and without both values was rejected above.
            create: {
              MaLoaiPhong: maLoaiPhong,
              NgayApDung: item.NgayApDung,
              GiaPhong: item.GiaPhong ?? 0,
              SoLuongPhong: item.SoLuongPhong ?? 0,
              TrangThai: item.TrangThai,
            },
          })
        );
      }
      return saved;
    });
  }
}
