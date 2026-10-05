/**
 * Every error response of the API has this shape:
 *
 *   { success: false, message: string, code: ErrorCode, details?: ErrorDetail[] }
 *
 *  - message  human-readable (Vietnamese), safe to show to the user
 *  - code     stable machine-readable identifier; clients branch on this, never on the message
 *  - details  only for errors that have parts. For VALIDATION_ERROR (and conflicts that name several rows):
 *             [{ field, message }] where `field` is the request field (`a.b` for nested ones)
 * Stack traces, SQL text and internal objects are never part of it.
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_JSON: 'INVALID_JSON',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  /** The rooms chosen cannot hold the number of guests (quote / booking). */
  CAPACITY_EXCEEDED: 'CAPACITY_EXCEEDED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
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

/** The default code of an HTTP status, for errors that do not name a more specific one. */
export const codeForStatus = (statusCode: number): ErrorCode => {
  switch (statusCode) {
    case 400: return ERROR_CODES.BAD_REQUEST;
    case 401: return ERROR_CODES.UNAUTHORIZED;
    case 403: return ERROR_CODES.FORBIDDEN;
    case 404: return ERROR_CODES.NOT_FOUND;
    case 409: return ERROR_CODES.CONFLICT;
    case 413: return ERROR_CODES.PAYLOAD_TOO_LARGE;
    case 429: return ERROR_CODES.TOO_MANY_REQUESTS;
    default: return statusCode >= 500 ? ERROR_CODES.INTERNAL_ERROR : ERROR_CODES.BAD_REQUEST;
  }
};
