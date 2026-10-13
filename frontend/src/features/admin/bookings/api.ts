import { apiClient } from '../../../services/apiClient';
import type { PaginatedApiResponse } from '../../../types/api';

export interface AdminBookingListItem {
  MaDatPhong: number;
  MaXacNhanDatPhong: string;
  KhachHang: { MaTaiKhoan: number; HoTen: string; SoDienThoai: string };
  KhachSan: { MaKhachSan: number; TenKhachSan: string };
  NgayNhanPhong: string;
  NgayTraPhong: string;
  TongSoPhong: number;
  TongTienThanhToan: number;
  TrangThai: string;
  NgayTao: string;
}

export interface AdminBookingRefund {
  MaHoanTien: number;
  SoTienHoan: number;
  LyDoHoanTien: string;
  TrangThai: string;
  NgayYeuCau: string;
  NgayHoanTien: string | null;
}

export interface AdminBookingPayment {
  MaThanhToan: number;
  SoTien: number;
  PhuongThucThanhToan: string;
  MaGiaoDichDoiTac: string;
  TrangThai: string;
  ThoiGianGiaoDich: string;
  HoanTien: AdminBookingRefund[];
}

export interface AdminBookingDetail extends Omit<AdminBookingListItem, 'TongSoPhong' | 'KhachSan'> {
  KhachSan: AdminBookingListItem['KhachSan'] & {
    DiaChiChiTiet: string;
    GioNhanPhong: string;
    GioTraPhong: string;
  };
  TongTienPhong: number;
  SoTienGiam: number;
  GhiChu: string | null;
  NgayCapNhat: string;
  ChiTietPhong: Array<{ MaLoaiPhong: number; TenLoaiPhong: string; SoLuong: number }>;
  KhuyenMai: { MaKhuyenMai: number; MaCode: string; LoaiGiamGia: string; GiaTriGiam: number } | null;
  ChinhSachHuy: {
    MaChinhSachHuy: number;
    TenChinhSach: string;
    MoTa: string;
    ChiTiet: Array<{ SoGioTruocNhanPhong: number; TyLeHoanTien: number }>;
  };
  ThanhToan: AdminBookingPayment[];
}

export interface AdminBookingsQuery {
  page: number;
  limit: number;
  search?: string;
  trangThai?: string;
  hotelId?: number;
  from?: string;
  to?: string;
}

const queryString = (query: AdminBookingsQuery) => {
  const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) });
  if (query.search) params.set('search', query.search);
  if (query.trangThai) params.set('trangThai', query.trangThai);
  if (query.hotelId) params.set('hotelId', String(query.hotelId));
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  return params.toString();
};

export const listAdminBookings = async (query: AdminBookingsQuery) => {
  const response = await apiClient<AdminBookingListItem[], PaginatedApiResponse<AdminBookingListItem>>(`/admin/bookings?${queryString(query)}`);
  return { items: response.data ?? [], pagination: response.pagination };
};

export const getAdminBooking = async (id: number): Promise<AdminBookingDetail> =>
  (await apiClient<AdminBookingDetail>(`/admin/bookings/${id}`)).data as AdminBookingDetail;
