/**
 * M7 §1 (RB9) — "Đánh giá chỉ được tạo cho đơn đặt phòng đã hoàn tất thời
 * gian lưu trú... Đơn phải ở trạng thái hoàn tất" — i.e. DAT_PHONG.TrangThai
 * must actually be "Hoàn tất", not just CONFIRMED with a past NgayTraPhong.
 * Nothing before M7 ever transitions a booking into "Hoàn tất" — there is no
 * check-in/check-out staff action in this system, so the only signal
 * available is the stay's own end.
 *
 * The stay ends at the hotel's check-out time on NgayTraPhong, in Vietnam time (Asia/Ho_Chi_Minh, UTC+7): a
 * booking is completed once that INSTANT has passed — not at 00:00 UTC of the date, which would complete it
 * 7 hours after the guests may still be in the room.
 *
 * Same lazy-sweep approach as booking-expiry.ts (M6 §2): no cron/timer, no
 * new column — one UPDATE guarded by existing TrangThai + the check-out moment, run
 * at every read/write touchpoint that cares about a booking's current
 * status (list/detail, review eligibility, cancel, analytics).
 */
import { Prisma } from '../../generated/prisma/client';
import { BOOKING_STATUS } from '../../common/constants/hotel-status';
import { BUSINESS_UTC_OFFSET_MS } from '../../common/utils/business-time';

type RawExecutor = { $executeRaw(query: Prisma.Sql): Promise<number> };

const OFFSET_HOURS = BUSINESS_UTC_OFFSET_MS / 3_600_000;

export const completeFinishedBookings = async (db: RawExecutor, now: Date = new Date()): Promise<number> => {
  // check-out instant (UTC) = NgayTraPhong + GioTraPhong (a Vietnam wall-clock time) - 7 h
  const result = await db.$executeRaw(Prisma.sql`
    UPDATE d
    SET d.TrangThai = ${BOOKING_STATUS.COMPLETED},
        d.NgayCapNhat = ${now}
    FROM DAT_PHONG d
    JOIN KHACH_SAN k ON k.MaKhachSan = d.MaKhachSan
    WHERE d.TrangThai = ${BOOKING_STATUS.CONFIRMED}
      AND DATEADD(HOUR, -${OFFSET_HOURS}, DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00:00' AS TIME), k.GioTraPhong), CAST(d.NgayTraPhong AS DATETIME2))) < ${now}
  `);
  return Number(result);
};
