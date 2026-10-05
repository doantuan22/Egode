import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { ERROR_CODES } from '../common/errors/error-codes';

export const securityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  if (env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
};

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
}

interface RateEntry { count: number; resetAt: number }

/** Small in-process limiter. Production clusters should back this with a shared store. */
export const createRateLimiter = ({ windowMs, max, keyPrefix }: RateLimitOptions) => {
  const entries = new Map<string, RateEntry>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = `${keyPrefix}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    let entry = entries.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      entries.set(key, entry);
    }
    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ success: false, message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.', code: ERROR_CODES.TOO_MANY_REQUESTS });
      return;
    }

    // Bound memory if an attacker rotates addresses for a long-running process.
    if (entries.size > 10_000) {
      for (const [entryKey, candidate] of entries) {
        if (candidate.resetAt <= now) entries.delete(entryKey);
      }
    }
    next();
  };
};
