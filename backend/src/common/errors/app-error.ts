import { codeForStatus, type ErrorCode } from './error-codes';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown, isOperational = true, code?: ErrorCode) {
    super(message);
    this.statusCode = statusCode;
    this.code = code ?? codeForStatus(statusCode);
    this.details = details;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad Request', details?: unknown, code?: ErrorCode): AppError {
    return new AppError(message, 400, details, true, code);
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(message, 401);
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(message, 403);
  }

  static notFound(message = 'Resource Not Found'): AppError {
    return new AppError(message, 404);
  }

  static conflict(message = 'Conflict', details?: unknown): AppError {
    return new AppError(message, 409, details);
  }

  static internal(message = 'Internal Server Error'): AppError {
    return new AppError(message, 500);
  }
}
