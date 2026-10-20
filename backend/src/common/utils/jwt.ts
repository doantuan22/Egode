import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { FINGERPRINT_PATTERN } from './password-fingerprint';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const JWT_ISSUER = 'hotel-booking-api';
const JWT_AUDIENCE = 'hotel-booking-web';
const JWT_ALGORITHM = 'HS256' as const;

export interface JwtPayload {
  sub: string;
  role: string;
}

/** Refresh token mang dấu vân tay mật khẩu để bị vô hiệu khi đổi mật khẩu */
export interface RefreshJwtPayload extends JwtPayload {
  pwdv: string;
}

interface SignedTokenPayload extends JwtPayload {
  typ: 'access' | 'refresh';
  pwdv?: unknown;
}

export const signAccessToken = (payload: JwtPayload): string => {
  const body: SignedTokenPayload = { ...payload, typ: 'access' };
  return jwt.sign(body, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
    algorithm: JWT_ALGORITHM,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
};

export const signRefreshToken = (payload: RefreshJwtPayload): string => {
  const body: SignedTokenPayload = { ...payload, typ: 'refresh' };
  return jwt.sign(body, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
    algorithm: JWT_ALGORITHM,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
};

const assertPayload = (decoded: SignedTokenPayload, expectedType: SignedTokenPayload['typ']): JwtPayload => {
  const accountId = Number(decoded.sub);
  if (decoded.typ !== expectedType || !Number.isSafeInteger(accountId) || accountId <= 0 || typeof decoded.role !== 'string' || !decoded.role) {
    throw new Error('Invalid token payload');
  }
  return { sub: String(accountId), role: decoded.role };
};

export const verifyAccessToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: [JWT_ALGORITHM], issuer: JWT_ISSUER, audience: JWT_AUDIENCE,
  }) as SignedTokenPayload;
  return assertPayload(decoded, 'access');
};

export const verifyRefreshToken = (token: string): RefreshJwtPayload => {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
    algorithms: [JWT_ALGORITHM], issuer: JWT_ISSUER, audience: JWT_AUDIENCE,
  }) as SignedTokenPayload;
  const payload = assertPayload(decoded, 'refresh');
  // Refresh token thiếu dấu vân tay hợp lệ bị từ chối
  if (typeof decoded.pwdv !== 'string' || !FINGERPRINT_PATTERN.test(decoded.pwdv)) {
    throw new Error('Invalid token payload');
  }
  return { ...payload, pwdv: decoded.pwdv };
};

export const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';
export const REFRESH_TOKEN_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
