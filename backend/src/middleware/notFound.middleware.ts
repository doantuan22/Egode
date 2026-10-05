import { Request, Response } from 'express';
import { ERROR_CODES } from '../common/errors/error-codes';

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    code: ERROR_CODES.NOT_FOUND,
  });
};
