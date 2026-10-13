import { apiClient } from '../../services/apiClient';
import type { ApiPaginationMeta, PaginatedApiResponse } from '../../types/api';
import type { AvailablePromotion, Promotion, PromotionDetail, PromotionFormValues, PromotionListQuery } from './types';

const buildQuery = (query: PromotionListQuery): string => {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.TrangThai) params.set('TrangThai', query.TrangThai);
  if (query.LoaiGiamGia) params.set('LoaiGiamGia', query.LoaiGiamGia);
  return params.toString();
};

export const listPromotions = async (
  query: PromotionListQuery
): Promise<{ items: Promotion[]; pagination: ApiPaginationMeta }> => {
  const res = await apiClient<Promotion[], PaginatedApiResponse<Promotion>>(`/admin/promotions?${buildQuery(query)}`);
  return { items: res.data ?? [], pagination: res.pagination };
};

export const getPromotion = async (id: number): Promise<PromotionDetail> => {
  const res = await apiClient<PromotionDetail>(`/admin/promotions/${id}`);
  return res.data as PromotionDetail;
};

export const createPromotion = async (payload: PromotionFormValues): Promise<Promotion> => {
  const res = await apiClient<Promotion>('/admin/promotions', { method: 'POST', body: JSON.stringify(payload) });
  return res.data as Promotion;
};

export const updatePromotion = async (id: number, payload: Partial<PromotionFormValues>): Promise<Promotion> => {
  const res = await apiClient<Promotion>(`/admin/promotions/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  return res.data as Promotion;
};

export const activatePromotion = async (id: number): Promise<Promotion> => {
  const res = await apiClient<Promotion>(`/admin/promotions/${id}/activate`, { method: 'POST' });
  return res.data as Promotion;
};

export const deactivatePromotion = async (id: number): Promise<Promotion> => {
  const res = await apiClient<Promotion>(`/admin/promotions/${id}/deactivate`, { method: 'POST' });
  return res.data as Promotion;
};

/** Public: the codes that can be used right now (active, today inside their window, uses left). */
export const listAvailablePromotions = async (): Promise<AvailablePromotion[]> => {
  const res = await apiClient<AvailablePromotion[]>('/promotions/available');
  return res.data ?? [];
};
