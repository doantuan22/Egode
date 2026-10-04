import { z } from 'zod';
import { refineStayDates } from '../../common/utils/stay-dates';

const quoteRoomLineSchema = z.object({
  maLoaiPhong: z.coerce.number().int().positive(),
  soLuong: z.coerce.number().int().min(1, 'Số lượng phòng phải từ 1 trở lên'),
});

export const quoteRequestSchema = z
  .object({
    checkIn: z.coerce.date(),
    checkOut: z.coerce.date(),
    rooms: z.array(quoteRoomLineSchema).min(1, 'Cần chọn ít nhất 1 loại phòng'),
    promoCode: z.string().trim().min(1).optional(),
  })
  .superRefine(refineStayDates)
  .refine(
    (d) => {
      const ids = d.rooms.map((r) => r.maLoaiPhong);
      return new Set(ids).size === ids.length;
    },
    { message: 'Mỗi loại phòng chỉ được xuất hiện một lần — gộp số lượng vào cùng một dòng', path: ['rooms'] }
  );
export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;

export const hotelIdParamSchema = z.object({ id: z.coerce.number().int().positive() });
