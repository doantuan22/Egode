import { z } from 'zod';
import { timeOfDaySchema } from '../../common/utils/time-of-day';
export const hotelIdSchema = z.object({ id: z.coerce.number().int().positive() });
export const listHotelsSchema = z.object({ page:z.coerce.number().int().positive().default(1), limit:z.coerce.number().int().min(1).max(100).default(20), search:z.string().trim().max(255).optional(), TrangThai:z.string().max(30).optional() });
export const updateHotelSchema = z.object({ TenKhachSan:z.string().min(2).max(255), DiaChiChiTiet:z.string().min(5).max(500), HangSao:z.coerce.number().int().min(1).max(5), MoTa:z.string().max(4000).nullable(), GioNhanPhong:timeOfDaySchema, GioTraPhong:timeOfDaySchema, MaDiaPhuong:z.coerce.number().int().positive() }).partial();
export type ListHotelsQuery=z.infer<typeof listHotelsSchema>; export type UpdateHotelInput=z.infer<typeof updateHotelSchema>;
