import { z } from 'zod';
import { ROOM_RATE_STATUS } from '../../common/constants/hotel-status';

export const roomTypeIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const listRatesQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((d) => d.to.getTime() >= d.from.getTime(), { message: '"to" phải sau hoặc bằng "from"', path: ['to'] });
export type ListRatesQuery = z.infer<typeof listRatesQuerySchema>;

// GiaPhong / SoLuongPhong may be left out to change only the sale status (or only one of the two): an omitted field
// keeps the value already stored for that day. A day that has no row yet needs both, to be created.
const rateItemSchema = z.object({
  NgayApDung: z.coerce.date(),
  GiaPhong: z.coerce.number().min(0, 'Giá phòng không được âm').optional(),
  SoLuongPhong: z.coerce.number().int().min(0, 'Số lượng phòng không được âm').optional(),
  TrangThai: z.enum([ROOM_RATE_STATUS.OPEN_FOR_SALE, ROOM_RATE_STATUS.CLOSED]).default(ROOM_RATE_STATUS.OPEN_FOR_SALE),
});

export const bulkUpsertRatesSchema = z
  .object({
    rates: z.array(rateItemSchema).min(1, 'Cần ít nhất 1 ngày').max(366, 'Tối đa 366 ngày mỗi lần cập nhật'),
  })
  .refine(
    (data) => {
      const keys = data.rates.map((r) => r.NgayApDung.toISOString().slice(0, 10));
      return new Set(keys).size === keys.length;
    },
    { message: 'Không được có ngày trùng lặp trong cùng một lần cập nhật', path: ['rates'] }
  );
export type BulkUpsertRatesInput = z.infer<typeof bulkUpsertRatesSchema>;
