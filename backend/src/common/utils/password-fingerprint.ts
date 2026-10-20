import { createHash, timingSafeEqual } from 'crypto';

/** Giá trị rút gọn từ mật khẩu băm hiện tại, dùng trong token */
export const FINGERPRINT_PATTERN = /^[a-f0-9]{32}$/;

export const passwordFingerprint = (passwordHash: string): string =>
  createHash('sha256').update(passwordHash).digest('hex').slice(0, 32);

/** So sánh dấu vân tay với mật khẩu băm đang lưu */
export const matchesPasswordFingerprint = (fp: string, currentPasswordHash: string): boolean => {
  const presented = Buffer.from(fp);
  const expected = Buffer.from(passwordFingerprint(currentPasswordHash));
  return presented.length === expected.length && timingSafeEqual(presented, expected);
};
