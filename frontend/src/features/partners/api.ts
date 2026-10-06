import { apiClient } from '../../services/apiClient';
import type { PartnerApplication, ApplyPartnerPayload, PaginationMeta } from '../../types/auth';
import type { PaginatedApiResponse } from '../../types/api';

export interface AdminPartnerApplication extends PartnerApplication {
  TAI_KHOAN_HO_SO_DOI_TAC_MaTaiKhoanToTAI_KHOAN: { MaTaiKhoan: number; HoTen: string; Email: string; SoDienThoai?: string; MaVaiTro?: number };
  TAI_KHOAN_HO_SO_DOI_TAC_MaTaiKhoanDuyetToTAI_KHOAN?: { MaTaiKhoan: number; HoTen: string; Email?: string } | null;
}

export interface AdminPartnerApplicationListResult {
  items: AdminPartnerApplication[];
  pagination: PaginationMeta;
}

export const applyPartner = async (payload: ApplyPartnerPayload): Promise<PartnerApplication> => {
  const res = await apiClient<PartnerApplication>('/partners/apply', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data as PartnerApplication;
};

export const getMyPartnerApplication = async (): Promise<PartnerApplication | null> => {
  const res = await apiClient<PartnerApplication | null>('/partners/me');
  return res.data ?? null;
};

export const listPartnerApplications = async (
  trangThaiDuyet?: string,
  page = 1,
  limit = 10,
): Promise<AdminPartnerApplicationListResult> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (trangThaiDuyet) params.set('trangThaiDuyet', trangThaiDuyet);
  const res = await apiClient<AdminPartnerApplication[], PaginatedApiResponse<AdminPartnerApplication>>('/admin/partner-applications?' + params.toString());
  return { items: res.data ?? [], pagination: res.pagination as PaginationMeta };
};

export const getPartnerApplication = async (id: number): Promise<AdminPartnerApplication> => {
  const res = await apiClient<AdminPartnerApplication>(`/admin/partner-applications/${id}`);
  return res.data as AdminPartnerApplication;
};

export const approvePartnerApplication = async (id: number): Promise<AdminPartnerApplication> => {
  const res = await apiClient<AdminPartnerApplication>(`/admin/partner-applications/${id}/approve`, { method: 'POST' });
  return res.data as AdminPartnerApplication;
};

export const rejectPartnerApplication = async (id: number, LyDoTuChoi: string): Promise<AdminPartnerApplication> => {
  const res = await apiClient<AdminPartnerApplication>(`/admin/partner-applications/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ LyDoTuChoi }),
  });
  return res.data as AdminPartnerApplication;
};
