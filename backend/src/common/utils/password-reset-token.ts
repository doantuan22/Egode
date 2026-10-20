import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { FINGERPRINT_PATTERN, passwordFingerprint } from './password-fingerprint';

// Xuất lại để nơi khác import từ đây
export { matchesPasswordFingerprint } from './password-fingerprint';

export const PASSWORD_RESET_TOKEN_TTL_MINUTES = 15;
const RESET_TOKEN_TTL = `${PASSWORD_RESET_TOKEN_TTL_MINUTES}m`;
const RESET_TOKEN_ISSUER = 'hotel-booking-api';
const RESET_TOKEN_AUDIENCE = 'hotel-booking-password-reset';

interface ResetTokenPayload {
  sub: string;
  typ: 'pwd_reset';
  fp: string;
}

/** Token đặt lại mật khẩu không lưu trạng thái, gắn với mật khẩu hiện tại */
export const signPasswordResetToken = (maTaiKhoan: number, currentPasswordHash: string): string => {
  const payload: ResetTokenPayload = {
    sub: String(maTaiKhoan),
    typ: 'pwd_reset',
    fp: passwordFingerprint(currentPasswordHash),
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: RESET_TOKEN_TTL,
    algorithm: 'HS256',
    issuer: RESET_TOKEN_ISSUER,
    audience: RESET_TOKEN_AUDIENCE,
  });
};

/** Kiểm tra chữ ký và hạn của token đặt lại mật khẩu */
export const decodePasswordResetToken = (token: string): { maTaiKhoan: number; fp: string } => {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'], issuer: RESET_TOKEN_ISSUER, audience: RESET_TOKEN_AUDIENCE,
  }) as ResetTokenPayload;
  const accountId = Number(decoded.sub);
  if (decoded.typ !== 'pwd_reset' || !Number.isSafeInteger(accountId) || accountId <= 0 || !FINGERPRINT_PATTERN.test(decoded.fp)) {
    throw new Error('Invalid token type');
  }
  return { maTaiKhoan: accountId, fp: decoded.fp };
};

