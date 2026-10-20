/** Chuyển đơn đã xác nhận sang Hoàn tất khi quá giờ trả phòng */
import { Prisma } from '../../generated/prisma/client';
import { BOOKING_STATUS } from '../../common/constants/hotel-status';
import { BUSINESS_UTC_OFFSET_MS } from '../../common/utils/business-time';

type RawExecutor = { $executeRaw(query: Prisma.Sql): Promise<number> };

const OFFSET_HOURS = BUSINESS_UTC_OFFSET_MS / 3_600_000;

export const completeFinishedBookings = async (db: RawExecutor, now: Date = new Date()): Promise<number> => {
  // Thời điểm trả phòng theo UTC bằng ngày trả cộng giờ trả trừ 7 giờ
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
