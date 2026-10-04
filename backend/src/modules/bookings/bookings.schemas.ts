import { z } from 'zod';
import { refineStayDates } from '../../common/utils/stay-dates';

const bookingRoomLineSchema = z.object({
  maLoaiPhong: z.coerce.number().int().positive(),
  soLuong: z.coerce.number().int().min(1, 'Số lượng phòng phải từ 1 trở lên'),
});

export const createBookingSchema = z
  .object({
    checkIn: z.coerce.date(),
    checkOut: z.coerce.date(),
    rooms: z.array(bookingRoomLineSchema).min(1, 'Cần chọn ít nhất 1 loại phòng'),
    promoCode: z.string().trim().min(1).optional(),
    ghiChu: z.string().trim().max(1000).optional(),
  })
  .superRefine(refineStayDates)
  .refine(
    (d) => {
      const ids = d.rooms.map((r) => r.maLoaiPhong);
      return new Set(ids).size === ids.length;
    },
    { message: 'Mỗi loại phòng chỉ được xuất hiện một lần — gộp số lượng vào cùng một dòng', path: ['rooms'] }
  );
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const hotelIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const bookingIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

// A cancel request legitimately has no body (e.g. a bare `fetch(url, { method: 'POST' })`)
// — accept a missing/undefined body the same as an empty one.
export const cancelBookingSchema = z
  .object({
    ghiChu: z.string().trim().max(1000).optional(),
  })
  .optional()
  .default({});
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
