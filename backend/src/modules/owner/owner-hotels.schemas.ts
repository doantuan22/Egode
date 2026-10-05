import { z } from 'zod';
import { validateImageDataUri } from '../../common/utils/image-upload';
import { timeOfDaySchema } from '../../common/utils/time-of-day';

const timeOfDay = timeOfDaySchema; // the same "HH:mm" contract as the admin API

// TrangThai/MaTaiKhoanDuyet/NgayDuyet/MaTaiKhoanSoHuu are intentionally
// excluded — owners cannot self-approve or reassign ownership (M3 §5).
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
  // Data URI (base64) — see docs/m3-report.md for why this avoids adding
  // multer/multipart parsing while still reusing the existing Cloudinary
  // integration exactly as-is (CloudinaryIntegration.uploadImage accepts a
  // file path OR a base64 string).
  image: z.string().min(1, 'Thiếu dữ liệu ảnh').transform(validateImageDataUri),
});
export type UploadImageInput = z.infer<typeof uploadImageSchema>;
