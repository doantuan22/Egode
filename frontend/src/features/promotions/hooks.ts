import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  activatePromotion,
  createPromotion,
  deactivatePromotion,
  getPromotion,
  listAvailablePromotions,
  listPromotions,
  updatePromotion,
} from './api';
import type { PromotionFormValues, PromotionListQuery } from './types';

export function usePromotionList(query: PromotionListQuery) {
  return useQuery({
    queryKey: ['admin', 'promotions', query],
    queryFn: () => listPromotions(query),
    placeholderData: keepPreviousData,
  });
}

export function usePromotionDetail(id: number) {
  return useQuery({
    queryKey: ['admin', 'promotions', 'detail', id],
    queryFn: () => getPromotion(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}

export function useCreatePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PromotionFormValues) => createPromotion(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'promotions'] }),
  });
}

export function useUpdatePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<PromotionFormValues> }) => updatePromotion(id, payload),
    onSuccess: (promo) => {
      queryClient.setQueryData(['admin', 'promotions', 'detail', promo.MaKhuyenMai], (prev: unknown) => ({ ...(prev as object), ...promo }));
      queryClient.invalidateQueries({ queryKey: ['admin', 'promotions'] });
    },
  });
}

export function useSetPromotionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => (active ? activatePromotion(id) : deactivatePromotion(id)),
    onSuccess: (promo) => {
      queryClient.setQueryData(['admin', 'promotions', 'detail', promo.MaKhuyenMai], (prev: unknown) => ({ ...(prev as object), ...promo }));
      queryClient.invalidateQueries({ queryKey: ['admin', 'promotions'] });
    },
  });
}

/** Mã khách chọn trong khung đặt phòng */
export function useAvailablePromotions(enabled = true) {
  return useQuery({
    queryKey: ['promotions', 'available'],
    queryFn: listAvailablePromotions,
    enabled,
    staleTime: 60_000,
  });
}
