import { z } from 'zod';
import { refineStayDates } from '../../common/utils/stay-dates';

const dateOnly = z.coerce.date();

export const searchHotelsQuerySchema = z
  .object({
    location: z.string().trim().max(255).optional(),
    // Từ khóa khớp tên, địa chỉ, thành phố hoặc tỉnh
    keyword: z.string().trim().max(100).optional(),
    checkIn: dateOnly,
    checkOut: dateOnly,
    guests: z.coerce.number().int().min(1).max(50).default(1),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    starRating: z.coerce.number().int().min(1).max(5).optional(),
    // Danh sách mã tiện nghi cách nhau bởi dấu phẩy
    amenities: z
      .string()
      .trim()
      .optional()
      .transform((val) =>
        val
          ? val
              .split(',')
              .map((v) => Number(v.trim()))
              .filter((n) => Number.isInteger(n) && n > 0)
          : undefined
      ),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    sort: z.enum(['price_asc', 'price_desc', 'star_desc', 'newest']).default('price_asc'),
  })
  .superRefine(refineStayDates)
  .refine((data) => data.minPrice === undefined || data.maxPrice === undefined || data.minPrice <= data.maxPrice, {
    message: 'minPrice phải nhỏ hơn hoặc bằng maxPrice',
    path: ['minPrice'],
  });
export type SearchHotelsQuery = z.infer<typeof searchHotelsQuerySchema>;

export const hotelIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const hotelRoomsQuerySchema = z
  .object({
    checkIn: dateOnly,
    checkOut: dateOnly,
    guests: z.coerce.number().int().min(1).max(50).optional(),
  })
  .superRefine(refineStayDates);
export type HotelRoomsQuery = z.infer<typeof hotelRoomsQuerySchema>;
