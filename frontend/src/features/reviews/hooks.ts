import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { adminGetReview, adminListReviews, createReview, getHotelReviews, getMyReview, moderateReview, removeViolationReview } from './api';
import type { AdminReviewListQuery, CreateReviewRequest } from './types';

/** Public reviews of a hotel (no sign-in needed). Keyed under "hotels" so they stay cached across sessions like the rest of the catalogue. */
export function useHotelReviews(hotelId: number, page: number, limit: number) {
  return useQuery({
    queryKey: ['hotels', 'reviews', hotelId, page, limit],
    queryFn: () => getHotelReviews(hotelId, page, limit),
    enabled: Number.isFinite(hotelId) && hotelId > 0,
    placeholderData: keepPreviousData,
  });
}

export function useMyReview(bookingId: number, enabled = true) {
  return useQuery({
    queryKey: ['reviews', 'mine', bookingId],
    queryFn: () => getMyReview(bookingId),
    enabled: enabled && Number.isFinite(bookingId) && bookingId > 0,
  });
}

export function useCreateReview(bookingId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateReviewRequest) => createReview(bookingId, payload),
    onSuccess: (review) => {
      queryClient.setQueryData(['reviews', 'mine', bookingId], review);
    },
  });
}

export function useAdminReviewList(query: AdminReviewListQuery) {
  return useQuery({
    queryKey: ['admin', 'reviews', query],
    queryFn: () => adminListReviews(query),
    placeholderData: keepPreviousData,
  });
}

export function useAdminReviewDetail(id: number) {
  return useQuery({
    queryKey: ['admin', 'reviews', 'detail', id],
    queryFn: () => adminGetReview(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}

export function useModerateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, trangThai }: { id: number; trangThai: string }) => moderateReview(id, trangThai),
    onSuccess: (review) => {
      queryClient.setQueryData(['admin', 'reviews', 'detail', review.MaDanhGia], review);
      queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
    },
  });
}

export function useRemoveViolationReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => removeViolationReview(id),
    onSuccess: (review) => {
      queryClient.setQueryData(['admin', 'reviews', 'detail', review.MaDanhGia], review);
      queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
    },
  });
}
