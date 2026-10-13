import { z } from 'zod';
import { timeOfDaySchema } from '../../common/utils/time-of-day';
export const hotelIdSchema = z.object({ id: z.coerce.number().int().positive() });
export const listHotelsSchema = z.object({ page:z.coerce.number().int().positive().default(1), limit:z.coerce.number().int().min(1).max(100).default(20), search:z.string().trim().max(255).optional(), TrangThai:z.string().max(30).optional() });
export const updateHotelSchema = z.object({ TenKhachSan:z.string().min(2).max(255), DiaChiChiTiet:z.string().min(5).max(500), HangSao:z.coerce.number().int().min(1).max(5), MoTa:z.string().max(4000).nullable(), GioNhanPhong:timeOfDaySchema, GioTraPhong:timeOfDaySchema, MaDiaPhuong:z.coerce.number().int().positive() }).partial();
export type ListHotelsQuery=z.infer<typeof listHotelsSchema>; export type UpdateHotelInput=z.infer<typeof updateHotelSchema>;

export const amenityIdSchema = z.object({ id: z.coerce.number().int().positive() });
const amenityName = z.string().trim().min(2, 'Tên tiện nghi tối thiểu 2 ký tự').max(150, 'Tên tiện nghi tối đa 150 ký tự');
const amenityIcon = z.string().trim().max(255).nullable().transform((value) => (value ? value : null));
export const createAmenitySchema = z.object({ TenTienNghi: amenityName, BieuTuong: amenityIcon.optional() });
export const updateAmenitySchema = z
  .object({ TenTienNghi: amenityName, BieuTuong: amenityIcon })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Không có thông tin nào để cập nhật' });
export type CreateAmenityInput = z.infer<typeof createAmenitySchema>;
export type UpdateAmenityInput = z.infer<typeof updateAmenitySchema>;
