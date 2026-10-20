import { getPrismaClient } from '../../config/prisma';
import { expireStalePendingBookings } from './booking-expiry';
import { completeFinishedBookings } from './booking-completion';

/** Cập nhật trạng thái đơn theo thời gian trước mọi thao tác đọc phụ thuộc */
export const releaseExpiredHolds = async (): Promise<void> => {
  await expireStalePendingBookings(getPrismaClient());
};

export const reconcileBookingLifecycle = async (): Promise<void> => {
  await expireStalePendingBookings(getPrismaClient());
  await completeFinishedBookings(getPrismaClient());
};
