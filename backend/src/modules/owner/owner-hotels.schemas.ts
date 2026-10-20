import { z } from 'zod';
import { validateImageDataUri } from '../../common/utils/image-upload';
import { timeOfDaySchema } from '../../common/utils/time-of-day';

const timeOfDay = timeOfDaySchema;

// Chủ khách sạn không tự duyệt hay đổi chủ sở hữu
export const createHotelSchema = z.object({
  TenKhachSan: z.string().min(2, 'Tên khách sạn ít nhất 2 ký tự').max(255),
  DiaChiChiTiet: z.string().min(5, 'Địa chỉ chi tiết ít nhất 5 ký tự').max(500),
  HangSao: z.coerce.number().int().min(1).max(5),
  MoTa: z.string().max(4000).optional(),
  GioNhanPhong: timeOfDay,
  GioTraPhong: timeOfDay,
  MaDiaPhuong: z.coerce.number().int().positive(),
});
export type CreateHotelInput = z.infer<typeof createHotelSchema>;

export const updateHotelSchema = z
  .object({
    TenKhachSan: z.string().min(2).max(255),
    DiaChiChiTiet: z.string().min(5).max(500),
    HangSao: z.coerce.number().int().min(1).max(5),
    MoTa: z.string().max(4000),
    GioNhanPhong: timeOfDay,
    GioTraPhong: timeOfDay,
    MaDiaPhuong: z.coerce.number().int().positive(),
  })
  .partial();
export type UpdateHotelInput = z.infer<typeof updateHotelSchema>;

export const hotelIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const hotelImageIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  imageId: z.coerce.number().int().positive(),
});

export const replaceAmenitiesSchema = z.object({
  amenityIds: z.array(z.coerce.number().int().positive()).default([]),
});
export type ReplaceAmenitiesInput = z.infer<typeof replaceAmenitiesSchema>;

export const uploadImageSchema = z.object({
  // Ảnh gửi dạng data URI base64
  image: z.string().min(1, 'Thiếu dữ liệu ảnh').transform(validateImageDataUri),
});
export type UploadImageInput = z.infer<typeof uploadImageSchema>;
