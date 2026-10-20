import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

const REQUEST_ID_HEADER = 'X-Request-Id';

/** Ghi log truy cập có cấu trúc, không ghi dữ liệu nhạy cảm */
export const requestLogging = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = String(req.headers[REQUEST_ID_HEADER.toLowerCase()] || randomUUID());
  res.setHeader(REQUEST_ID_HEADER, requestId);

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    // Bỏ log từng request khi chạy test
    if (process.env.NODE_ENV === 'test') return;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const errorCategory = res.statusCode >= 500 ? 'server_error' : res.statusCode >= 400 ? 'client_error' : undefined;
    const line = {
      requestId,
      method: req.method,
      route: req.route?.path ? `${req.baseUrl}${req.route.path}` : req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ...(errorCategory ? { errorCategory } : {}),
    };
    console.log(JSON.stringify(line));
  });

  next();
};
