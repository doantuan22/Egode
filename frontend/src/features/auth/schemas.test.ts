import { describe, expect, it } from 'vitest';
import { registerSchema } from './schemas';

const base = { HoTen: 'Nguyễn Văn An', TenDangNhap: 'nguyenvanan', Email: 'an@example.com', SoDienThoai: '0901234567', MatKhau: 'Password123', confirmMatKhau: 'Password123', NgaySinh: '' };

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
