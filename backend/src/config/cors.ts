import { env } from './env';

/** The browser origins allowed to call the API with credentials (exact match, no wildcard). */
export const allowedOrigins: string[] = (env.CORS_ORIGIN || env.FRONTEND_URL)
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

export const isAllowedOrigin = (origin: string): boolean => allowedOrigins.includes(origin.replace(/\/$/, ''));
