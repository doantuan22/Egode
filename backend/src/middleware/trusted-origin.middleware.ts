import { NextFunction, Request, Response } from 'express';
import { isAllowedOrigin } from '../config/cors';
import { AppError } from '../common/errors/app-error';

/** Chặn request cookie refresh từ origin không tin cậy */
export const requireTrustedOrigin = (req: Request, _res: Response, next: NextFunction): void => {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin !== '' && !isAllowedOrigin(origin)) {
    return next(AppError.forbidden('Origin không được phép'));
  }
  next();
};
