import { describe, expect, it } from 'vitest';
import { registerSchema } from './schemas';

const base = { HoTen: 'Nguyễn Văn An', TenDangNhap: 'nguyenvanan', Email: 'an@example.com', SoDienThoai: '0901234567', MatKhau: 'Password123', confirmMatKhau: 'Password123', NgaySinh: '', DongYDieuKhoan: true };

describe('registerSchema gender', () => {
  // react-hook-form reports an untouched radio group as null; before this was accepted the form refused to submit
  // without any message on screen.
  it.each([undefined, null, '', 'Nam', 'Nữ', 'Khác'])('accepts %j (optional field)', (GioiTinh) => {
    expect(registerSchema.safeParse({ ...base, GioiTinh }).success).toBe(true);
  });

  it('still rejects a value that is not a gender', () => {
    expect(registerSchema.safeParse({ ...base, GioiTinh: 'x' }).success).toBe(false);
  });
});

describe('registerSchema terms consent (NEW-1)', () => {
  const TERMS_MESSAGE = 'Vui lòng đồng ý với Điều khoản sử dụng và Chính sách bảo mật';

  it('accepts only an explicit true', () => {
    expect(registerSchema.safeParse({ ...base, DongYDieuKhoan: true }).success).toBe(true);
  });

  it.each([false, undefined, null, 'true', 1, 'on'])('rejects %j with the terms message on the checkbox field', (DongYDieuKhoan) => {
    const result = registerSchema.safeParse({ ...base, DongYDieuKhoan });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'DongYDieuKhoan');
      expect(issue).toBeDefined();
      if (DongYDieuKhoan === false) expect(issue?.message).toBe(TERMS_MESSAGE);
    }
  });

  it('does not weaken the other rules: a bad email or short password still fails even when the terms are accepted', () => {
    expect(registerSchema.safeParse({ ...base, Email: 'nope' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, MatKhau: 'short', confirmMatKhau: 'short' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, confirmMatKhau: 'Different123' }).success).toBe(false);
  });
});
