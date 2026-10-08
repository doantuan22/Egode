import { apiClient } from '../../../services/apiClient';
import type { PaginatedApiResponse } from '../../../types/api';

export interface AdminHotel {
  MaKhachSan: number;
  TenKhachSan: string;
  DiaChiChiTiet: string;
  HangSao: number;
  MoTa: string | null;
  TrangThai: string;
  MaDiaPhuong: number;
  /** "HH:mm", the same format the owner API uses. */
  GioNhanPhong?: string;
  GioTraPhong?: string;
  DIA_PHUONG?: { TenThanhPho: string; TenTinh?: string };
  TAI_KHOAN_KHACH_SAN_MaTaiKhoanSoHuuToTAI_KHOAN?: AdminHotelOwner;
  /** Cover first. The list carries only that one photo; the detail carries them all. */
  HINH_ANH_KHACH_SAN?: AdminHotelImage[];
}
export interface AdminHotelOwner { MaTaiKhoan: number; HoTen: string; Email: string; SoDienThoai: string | null }
export interface AdminHotelImage { MaHinhAnh: number; URL: string; AnhDaiDien: boolean }
export interface AdminHotelListResult { items: AdminHotel[]; pagination: { page: number; limit: number; total: number; totalPages: number }; }
export type AdminHotelQuery = { page: number; limit: number; search?: string; TrangThai?: string };
const queryString = (query: AdminHotelQuery) => { const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) }); if (query.search) params.set('search', query.search); if (query.TrangThai) params.set('TrangThai', query.TrangThai); return params.toString(); };
export const listAdminHotels = async (query: AdminHotelQuery): Promise<AdminHotelListResult> => { const result = await apiClient<AdminHotel[], PaginatedApiResponse<AdminHotel>>(`/admin/hotels?${queryString(query)}`); return { items: result.data ?? [], pagination: result.pagination }; };
export const getAdminHotel = async (id: number): Promise<AdminHotel> => (await apiClient<AdminHotel>(`/admin/hotels/${id}`)).data as AdminHotel;
export type UpdateAdminHotelPayload = Pick<AdminHotel, 'TenKhachSan' | 'DiaChiChiTiet' | 'HangSao' | 'MoTa' | 'GioNhanPhong' | 'GioTraPhong'>;
export const updateAdminHotel = async (id: number, payload: Partial<UpdateAdminHotelPayload>): Promise<AdminHotel> => (await apiClient<AdminHotel>(`/admin/hotels/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })).data as AdminHotel;
export const approveAdminHotel = async (id: number): Promise<AdminHotel> => (await apiClient<AdminHotel>(`/admin/hotels/${id}/approve`, { method: 'POST' })).data as AdminHotel;
export const rejectAdminHotel = async (id: number): Promise<AdminHotel> => (await apiClient<AdminHotel>(`/admin/hotels/${id}/reject`, { method: 'POST' })).data as AdminHotel;
export const suspendAdminHotel = async (id: number): Promise<AdminHotel> => (await apiClient<AdminHotel>(`/admin/hotels/${id}/suspend`, { method: 'POST' })).data as AdminHotel;
export const reactivateAdminHotel = async (id: number): Promise<AdminHotel> => (await apiClient<AdminHotel>(`/admin/hotels/${id}/reactivate`, { method: 'POST' })).data as AdminHotel;
