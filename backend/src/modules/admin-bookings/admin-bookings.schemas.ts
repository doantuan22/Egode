import { z } from 'zod';
import { BOOKING_STATUS } from '../../common/constants/hotel-status';

export const adminBookingsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  trangThai: z.enum([
    BOOKING_STATUS.PENDING_PAYMENT,
    BOOKING_STATUS.CONFIRMED,
    BOOKING_STATUS.CANCELLED,
    BOOKING_STATUS.COMPLETED,
  ]).optional(),
  hotelId: z.coerce.number().int().positive().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: 'Khoảng ngày nhận phòng không hợp lệ',
  path: ['to'],
});

export const adminBookingIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type AdminBookingsQuery = z.infer<typeof adminBookingsQuerySchema>;
