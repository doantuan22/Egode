import { z } from 'zod';
import { phoneNumberSchema } from '../../common/utils/phone-number';

export const listAccountsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).optional(),
  TrangThai: z.string().max(30).optional(),
  MaVaiTro: z.coerce.number().int().optional(),
});
export type ListAccountsQuery = z.infer<typeof listAccountsQuerySchema>;

export const createAccountSchema = z.object({
  TenDangNhap: z
    .string()
    .min(3)
    .max(100)
    .regex(/^[a-zA-Z0-9_.]+$/, 'Tên đăng nhập chỉ gồm chữ, số, dấu chấm hoặc gạch dưới'),
  Email: z.string().email(),
  MatKhau: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự').max(128),
  HoTen: z.string().min(2).max(150),
  SoDienThoai: phoneNumberSchema,
  // Cho phép để trống
  NgaySinh: z.coerce.date().optional(),
  GioiTinh: z.enum(['Nam', 'Nữ', 'Khác']).optional(),
  MaVaiTro: z.coerce.number().int(),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

// Không cho sửa trạng thái và mật khẩu qua cập nhật chung
export const updateAccountSchema = z
  .object({
    TenDangNhap: z
      .string()
      .min(3)
      .max(100)
      .regex(/^[a-zA-Z0-9_.]+$/),
    Email: z.string().email(),
    HoTen: z.string().min(2).max(150),
    SoDienThoai: phoneNumberSchema,
    NgaySinh: z.coerce.date(),
    GioiTinh: z.enum(['Nam', 'Nữ', 'Khác']),
    AnhDaiDien: z.string().max(500),
    MaVaiTro: z.coerce.number().int(),
  })
  .partial();
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export const accountIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
