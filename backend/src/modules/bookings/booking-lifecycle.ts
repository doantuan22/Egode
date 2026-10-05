import { getPrismaClient } from '../../config/prisma';
import { expireStalePendingBookings } from './booking-expiry';
import { completeFinishedBookings } from './booking-completion';

/**
 * Bookings change status lazily (there is no background job): an unpaid "Chờ thanh toán" booking older than the
 * payment timeout becomes "Đã hủy" and stops holding rooms; a "Đã xác nhận" stay past check-out becomes
 * "Hoàn tất". Every read whose answer depends on that — room availability (search, rooms, quote, booking),
 * booking lists and the analytics — runs this first, so they all apply the SAME rule at the same moment and
 * can never disagree about whether a stale hold still occupies a room.
 */
export const releaseExpiredHolds = async (): Promise<void> => {
  await expireStalePendingBookings(getPrismaClient());
};

export const reconcileBookingLifecycle = async (): Promise<void> => {
  await expireStalePendingBookings(getPrismaClient());
  await completeFinishedBookings(getPrismaClient());
};
