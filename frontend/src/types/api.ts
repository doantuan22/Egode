export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  /** Mã lỗi trên mọi phản hồi thất bại */
  code?: string;
  /** Chi tiết lỗi theo trường */
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
