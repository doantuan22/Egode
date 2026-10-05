export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  /** Machine-readable error code (see common/errors/error-codes.ts); present on every failure. */
  code?: string;
  /** For failures with parts, e.g. validation: [{ field, message }]. */
  details?: unknown;
}

export interface ApiPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  pagination: ApiPaginationMeta;
}
