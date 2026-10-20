import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Vui lòng nhập email hoặc tên đăng nhập').max(255),
  MatKhau: z.string().min(1, 'Vui lòng nhập mật khẩu').max(128),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

// Ô ngày hoặc select chưa chọn trả về chuỗi rỗng
export const GENDER_OPTIONS = ['Nam', 'Nữ', 'Khác'] as const;

export const registerSchema = z
  .object({
    TenDangNhap: z
      .string()
      .min(3, 'Tên đăng nhập ít nhất 3 ký tự')
      .regex(/^[a-zA-Z0-9_.]+$/, 'Chỉ gồm chữ, số, dấu chấm hoặc gạch dưới'),
    Email: z.string().email('Email không đúng định dạng').max(255),
    HoTen: z.string().trim().min(2, 'Họ và tên ít nhất 2 ký tự').max(150),
    SoDienThoai: z.string().regex(/^\+?[0-9]{8,15}$/, 'Số điện thoại không hợp lệ'),
    // Số điện thoại có thể để trống
    NgaySinh: z.string().optional(),
    // Radio chưa chọn là null, cùng nghĩa với chưa chọn
    GioiTinh: z.enum([...GENDER_OPTIONS, '']).nullish(),
    MatKhau: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự').max(128),
    confirmMatKhau: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
    // Đồng ý điều khoản chỉ có ở form và phải đúng là true
    DongYDieuKhoan: z.boolean().refine((accepted) => accepted, 'Vui lòng đồng ý với Điều khoản sử dụng và Chính sách bảo mật'),
  })
  .refine((data) => data.MatKhau === data.confirmMatKhau, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmMatKhau'],
  });
export type RegisterFormValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  Email: z.string().email('Email không đúng định dạng').max(255),
});
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Thiếu token đặt lại mật khẩu').max(4096),
    MatKhauMoi: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự').max(128),
    confirmMatKhauMoi: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
  })
  .refine((data) => data.MatKhauMoi === data.confirmMatKhauMoi, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmMatKhauMoi'],
  });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

// Cùng quy tắc với backend khi đổi mật khẩu
export const changePasswordSchema = z
  .object({
    MatKhauCu: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại').max(128),
    MatKhauMoi: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự').max(128),
    confirmMatKhauMoi: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới'),
  })
  .refine((data) => data.MatKhauMoi === data.confirmMatKhauMoi, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmMatKhauMoi'],
  });
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z.object({
  HoTen: z.string().min(2, 'Họ và tên ít nhất 2 ký tự'),
  SoDienThoai: z.string().min(8, 'Số điện thoại không hợp lệ'),
  NgaySinh: z.string().optional(),
  GioiTinh: z.enum([...GENDER_OPTIONS, '']).optional(),
});
export type UpdateProfileFormValues = z.infer<typeof updateProfileSchema>;
