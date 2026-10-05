import { apiClient } from '../../services/apiClient';
import type { ApiPaginationMeta, PaginatedApiResponse } from '../../types/api';
import type { AdminReviewDetail, AdminReviewListItem, AdminReviewListQuery, CreateReviewRequest, PublicReview, RatingSummary, Review } from './types';

export const createReview = async (bookingId: number, payload: CreateReviewRequest): Promise<Review> => {
  const res = await apiClient<Review>(`/bookings/${bookingId}/review`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data as Review;
};

export const getMyReview = async (bookingId: number): Promise<Review | null> => {
  const res = await apiClient<Review | null>(`/bookings/${bookingId}/review`);
  return res.data ?? null;
};

export interface PublicReviewsPage {
  items: PublicReview[];
  pagination: ApiPaginationMeta;
  summary: RatingSummary;
}

export const getHotelReviews = async (hotelId: number, page: number, limit: number): Promise<PublicReviewsPage> => {
  const res = await apiClient<PublicReview[], PaginatedApiResponse<PublicReview> & { summary: RatingSummary }>(`/hotels/${hotelId}/reviews?page=${page}&limit=${limit}`);
  return { items: res.data ?? [], pagination: res.pagination, summary: res.summary };
};

const buildQuery = (query: AdminReviewListQuery): string => {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.trangThai) params.set('trangThai', query.trangThai);
  if (query.diemDanhGia) params.set('diemDanhGia', String(query.diemDanhGia));
  return params.toString();
};

export const adminListReviews = async (
  query: AdminReviewListQuery
): Promise<{ items: AdminReviewListItem[]; pagination: ApiPaginationMeta }> => {
  const res = await apiClient<AdminReviewListItem[], PaginatedApiResponse<AdminReviewListItem>>(
    `/admin/reviews?${buildQuery(query)}`
  );
  return { items: res.data ?? [], pagination: res.pagination };
};

export const adminGetReview = async (id: number): Promise<AdminReviewDetail> => {
  const res = await apiClient<AdminReviewDetail>(`/admin/reviews/${id}`);
  return res.data as AdminReviewDetail;
};

export const moderateReview = async (id: number, trangThai: string): Promise<AdminReviewDetail> => {
  const res = await apiClient<AdminReviewDetail>(`/admin/reviews/${id}/moderate`, {
    method: 'PATCH',
    body: JSON.stringify({ trangThai }),
  });
  return res.data as AdminReviewDetail;
};

/** UC37 safe-delete: server decides the final hidden status; no client body. */
export const removeViolationReview = async (id: number): Promise<AdminReviewDetail> => {
  const res = await apiClient<AdminReviewDetail>(`/admin/reviews/${id}`, { method: 'DELETE' });
  return res.data as AdminReviewDetail;
};
