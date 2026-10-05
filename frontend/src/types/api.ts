export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  /** Machine-readable error code on every failure (VALIDATION_ERROR, NOT_FOUND, CONFLICT, ...). */
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
