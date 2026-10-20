import { z } from 'zod';
import { phoneNumberSchema } from '../../common/utils/phone-number';

export const registerSchema = z.object({
  TenDangNhap: z
    .string()
    .min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự')
    .max(100)
    .regex(/^[a-zA-Z0-9_.]+$/, 'Tên đăng nhập chỉ gồm chữ, số, dấu chấm hoặc gạch dưới'),
  Email: z.string().trim().email('Email không đúng định dạng').max(255).transform((value) => value.toLowerCase()),
  MatKhau: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự').max(128),
  HoTen: z.string().trim().min(2, 'Họ tên ít nhất 2 ký tự').max(150),
  SoDienThoai: phoneNumberSchema,
  // Số điện thoại có thể để trống khi đăng ký
  NgaySinh: z.coerce.date().optional(),
  GioiTinh: z.enum(['Nam', 'Nữ', 'Khác']).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Vui lòng nhập email hoặc tên đăng nhập').max(255),
  MatKhau: z.string().min(1, 'Vui lòng nhập mật khẩu').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  Email: z.string().trim().email('Email không đúng định dạng').max(255).transform((value) => value.toLowerCase()),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Thiếu token đặt lại mật khẩu').max(4096),
  MatKhauMoi: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự').max(128),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  MatKhauCu: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại').max(128),
  MatKhauMoi: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự').max(128),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
