/** Dạng chung của mọi phản hồi lỗi từ API */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_JSON: 'INVALID_JSON',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  /** Phòng đã chọn không đủ sức chứa số khách */
  CAPACITY_EXCEEDED: 'CAPACITY_EXCEEDED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface ErrorDetail {
  field: string;
  message: string;
}

export interface ErrorBody {
  success: false;
  message: string;
  code: ErrorCode;
  details?: unknown;
}

/** Mã lỗi mặc định theo mã HTTP */
export const codeForStatus = (statusCode: number): ErrorCode => {
  switch (statusCode) {
    case 400: return ERROR_CODES.BAD_REQUEST;
    case 401: return ERROR_CODES.UNAUTHORIZED;
    case 403: return ERROR_CODES.FORBIDDEN;
    case 404: return ERROR_CODES.NOT_FOUND;
    case 409: return ERROR_CODES.CONFLICT;
    case 413: return ERROR_CODES.PAYLOAD_TOO_LARGE;
    case 429: return ERROR_CODES.TOO_MANY_REQUESTS;
    case 503: return ERROR_CODES.SERVICE_UNAVAILABLE;
    default: return statusCode >= 500 ? ERROR_CODES.INTERNAL_ERROR : ERROR_CODES.BAD_REQUEST;
  }
};
