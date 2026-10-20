import { env } from './env';

/** Các origin trình duyệt được phép gọi API kèm thông tin xác thực */
export const allowedOrigins: string[] = (env.CORS_ORIGIN || env.FRONTEND_URL)
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

export const isAllowedOrigin = (origin: string): boolean => allowedOrigins.includes(origin.replace(/\/$/, ''));
