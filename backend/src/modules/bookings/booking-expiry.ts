/** Tự hủy đơn Chờ thanh toán quá hạn để giải phóng phòng */
import { Prisma } from '../../generated/prisma/client';
import { BOOKING_STATUS } from '../../common/constants/hotel-status';
import { env } from '../../config/env';

const EXPIRY_NOTE = 'Tự động hủy do quá hạn thanh toán';

/** Kiểu cấu trúc dùng được cho PrismaClient hoặc giao dịch */
type RawExecutor = { $executeRaw(query: Prisma.Sql): Promise<number> };

export const expireStalePendingBookings = async (
  db: RawExecutor,
  now: Date = new Date()
): Promise<number> => {
  const cutoff = new Date(now.getTime() - env.PAYMENT_TIMEOUT_MINUTES * 60_000);
  const result = await db.$executeRaw(Prisma.sql`
    UPDATE DAT_PHONG
    SET TrangThai = ${BOOKING_STATUS.CANCELLED},
        NgayCapNhat = ${now},
        GhiChu = CASE WHEN GhiChu IS NULL THEN ${EXPIRY_NOTE} ELSE GhiChu + N' | ' + ${EXPIRY_NOTE} END
    WHERE TrangThai = ${BOOKING_STATUS.PENDING_PAYMENT} AND NgayTao < ${cutoff}
  `);
  return Number(result);
};

/** Thời điểm đơn chờ thanh toán bị tự hủy */
export const paymentDeadlineOf = (ngayTao: Date, timeoutMinutes: number = env.PAYMENT_TIMEOUT_MINUTES): Date =>
  new Date(ngayTao.getTime() + timeoutMinutes * 60_000);

/** Hạn thanh toán và số giây còn lại hiển thị cho đơn */
export const paymentHold = (
  ngayTao: Date,
  trangThai: string,
  now: Date = new Date(),
  timeoutMinutes: number = env.PAYMENT_TIMEOUT_MINUTES
): { HanThanhToan: string | null; SoGiayConLai: number | null } => {
  if (trangThai !== BOOKING_STATUS.PENDING_PAYMENT) return { HanThanhToan: null, SoGiayConLai: null };
  const deadline = paymentDeadlineOf(ngayTao, timeoutMinutes);
  return {
    HanThanhToan: deadline.toISOString(),
    SoGiayConLai: Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 1000)),
  };
};
