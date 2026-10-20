import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../common/errors/app-error';
import { ERROR_CODES, type ErrorBody, type ErrorDetail } from '../common/errors/error-codes';
import { env } from '../config/env';

const send = (res: Response, status: number, body: Omit<ErrorBody, 'success'>): void => {
  res.status(status).json({ success: false, ...body } satisfies ErrorBody);
};

/** Chuyển lỗi Zod thành danh sách field và message */
const toValidationDetails = (error: ZodError): ErrorDetail[] =>
  error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));

const logServerError = (label: string, error: Error, code?: string): void => {
  if (env.NODE_ENV === 'production') {
    console.error(label, { name: error.name, ...(code ? { code } : {}) });
    return;
  }
  console.error(label, error);
};

export const errorHandler: ErrorRequestHandler = (
  err: Error | AppError | ZodError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const parseError = err as Error & { type?: string; status?: number };
  if (parseError.type === 'entity.too.large' || parseError.status === 413) {
    send(res, 413, { message: 'Request body vượt quá giới hạn cho phép', code: ERROR_CODES.PAYLOAD_TOO_LARGE });
    return;
  }
  if (err instanceof SyntaxError && parseError.status === 400) {
    send(res, 400, { message: 'JSON không hợp lệ', code: ERROR_CODES.INVALID_JSON });
    return;
  }
  if (err instanceof ZodError) {
    send(res, 400, { message: 'Dữ liệu không hợp lệ', code: ERROR_CODES.VALIDATION_ERROR, details: toValidationDetails(err) });
    return;
  }

  // Lỗi nghiệp vụ trả về message và details của chính nó
  if (err instanceof AppError) {
    if (err.statusCode >= 500) logServerError('Operational server error:', err, err.code);
    send(res, err.statusCode, {
      message: err.statusCode >= 500 ? 'Internal server error' : err.message,
      code: err.code,
      ...(err.statusCode < 500 && err.details ? { details: err.details } : {}),
    });
    return;
  }

  // Lỗi không lường trước chỉ trả message chung
  logServerError('Unhandled server error:', err);
  send(res, 500, { message: 'Internal server error', code: ERROR_CODES.INTERNAL_ERROR });
};
