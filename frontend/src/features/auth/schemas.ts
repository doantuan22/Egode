import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Vui lòng nhập email hoặc tên đăng nhập').max(255),
  MatKhau: z.string().min(1, 'Vui lòng nhập mật khẩu').max(128),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

// An untouched <input type="date">/<select> submits '' — kept as a plain
// literal union (no preprocess/transform) so type inference stays simple
// and consistent between `tsc --noEmit` and the stricter `tsc -b` build.
// Components convert '' to undefined when building the API payload.
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
    // DDI-01 (resolved): optional — nullable in the baseline, not required at registration.
    NgaySinh: z.string().optional(),
    // An untouched radio group reports null, not undefined: both mean "not chosen".
    GioiTinh: z.enum([...GENDER_OPTIONS, '']).nullish(),
    MatKhau: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự').max(128),
    confirmMatKhau: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
    // Form-only consent (not sent to the API, no DB column): must be exactly true, so the rule lives in the schema
    // and not in an HTML `required` attribute (the form is noValidate, which switches that attribute off).
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

// Same policy as the backend (changePasswordSchema): the current password is required, the new one has 8-128 characters.
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
