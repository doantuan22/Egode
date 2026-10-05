import { NextFunction, Request, Response } from 'express';
import { isAllowedOrigin } from '../config/cors';
import { AppError } from '../common/errors/app-error';

/**
 * For endpoints authenticated ONLY by the refresh cookie (refresh, logout). With `SameSite=None` a foreign site's
 * page can make the browser attach that cookie to a request it cannot read the answer to, but it can still rotate or
 * clear the session; browsers always send `Origin` on such cross-site POSTs, so a request whose Origin is not one of
 * ours is refused before the cookie is looked at. A request without Origin (curl, server-to-server, same-origin
 * navigations that omit it) is not a cross-site browser request and is let through.
 */
export const requireTrustedOrigin = (req: Request, _res: Response, next: NextFunction): void => {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin !== '' && !isAllowedOrigin(origin)) {
    return next(AppError.forbidden('Origin không được phép'));
  }
  next();
};
