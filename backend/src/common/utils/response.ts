import { Response } from 'express';
import { codeForStatus } from '../errors/error-codes';
import { ApiResponse, PaginatedApiResponse, ApiPaginationMeta } from '../types/api-response';

export const sendSuccess = <T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode = 200
): Response => {
  const response: ApiResponse<T> = {
    success: true,
    ...(message ? { message } : {}),
    ...(data !== undefined ? { data } : {}),
  };
  return res.status(statusCode).json(response);
};

export const sendPaginated = <T>(
  res: Response,
  data: T[],
  pagination: ApiPaginationMeta,
  message?: string,
  statusCode = 200
): Response => {
  const response: PaginatedApiResponse<T> = {
    success: true,
    ...(message ? { message } : {}),
    data,
    pagination,
  };
  return res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = 500,
  details?: unknown
): Response => {
  const response: ApiResponse = {
    success: false,
    message,
    code: codeForStatus(statusCode),
    ...(details !== undefined ? { details } : {}),
  };
  return res.status(statusCode).json(response);
};
