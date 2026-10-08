import type { Amenity, DiaPhuong } from '../hotels/types';

export interface OwnerHotelImage {
  MaHinhAnh: number;
  MaKhachSan: number;
  URL: string;
  AnhDaiDien: boolean;
}

export interface OwnerHotelAmenityLink {
  MaKhachSan: number;
  MaTienNghi: number;
  TIEN_NGHI: Amenity;
}

export interface OwnerHotel {
  MaKhachSan: number;
  MaTaiKhoanSoHuu: number;
  MaDiaPhuong: number;
  MaTaiKhoanDuyet: number | null;
  TenKhachSan: string;
  DiaChiChiTiet: string;
  HangSao: number;
  MoTa: string | null;
  GioNhanPhong: string;
  GioTraPhong: string;
  TrangThai: string;
  NgayDangKy: string;
  NgayDuyet: string | null;
  NgayCapNhat: string;
  DIA_PHUONG: DiaPhuong;
  HINH_ANH_KHACH_SAN: OwnerHotelImage[];
  KHACH_SAN_TIEN_NGHI?: OwnerHotelAmenityLink[];
  /** Present on the owner's hotel list (GET /owner/hotels). */
  _count?: { LOAI_PHONG: number };
}

export interface OwnerRoomTypeImage {
  MaHinhAnhLoaiPhong: number;
  MaLoaiPhong: number;
  URL: string;
  LaAnhDaiDien: boolean;
}

export interface OwnerRoomTypeAmenityLink {
  MaLoaiPhong: number;
  MaTienNghi: number;
  TIEN_NGHI: Amenity;
}

export interface OwnerRoomType {
  MaLoaiPhong: number;
  MaKhachSan: number;
  TenLoaiPhong: string;
  SoGiuong: number;
  SucChua: number;
  DienTich: number;
  LoaiGiuong: string;
  MoTa: string | null;
  TrangThai: string;
  HINH_ANH_LOAI_PHONG: OwnerRoomTypeImage[];
  LOAI_PHONG_TIEN_NGHI: OwnerRoomTypeAmenityLink[];
  KHACH_SAN?: OwnerHotel;
}

export interface RateRow {
  MaQuyPhong: number;
  MaLoaiPhong: number;
  NgayApDung: string;
  GiaPhong: number;
  SoLuongPhong: number;
  TrangThai: string;
}

export interface HotelFormValues {
  TenKhachSan: string;
  DiaChiChiTiet: string;
  HangSao: number;
  MoTa?: string;
  GioNhanPhong: string;
  GioTraPhong: string;
  MaDiaPhuong: number;
}

export interface RoomTypeFormValues {
  TenLoaiPhong: string;
  SoGiuong: number;
  SucChua: number;
  DienTich: number;
  LoaiGiuong: string;
  MoTa?: string;
  TrangThai?: string;
}

export interface RateItemInput {
  NgayApDung: string;
  /** Omitted = keep the stored price of that day (only valid for a day that already has a row). */
  GiaPhong?: number;
  /** Omitted = keep the stored room count of that day (only valid for a day that already has a row). */
  SoLuongPhong?: number;
  TrangThai?: string;
}
export interface OwnerBooking { MaDatPhong: number; MaXacNhanDatPhong: string; KhachHang: { MaTaiKhoan: number; HoTen: string; SoDienThoai: string }; NgayNhanPhong: string; NgayTraPhong: string; TongTienThanhToan: number; TrangThai: string; NgayTao: string; GhiChu: string | null; GioNhanPhong: string; GioTraPhong: string; ChiTietPhong: Array<{ MaLoaiPhong: number; TenLoaiPhong: string; SoLuong: number }>; ThanhToan: Array<{ MaThanhToan: number; TrangThai: string; PhuongThucThanhToan: string; SoTien: number; ThoiGianGiaoDich: string }>; }
export interface OwnerBookingsFilters { page?: number; limit?: number; trangThai?: string; search?: string; from?: string; to?: string; }

/** One moderated review of an owned hotel (GET /owner/hotels/:id/reviews): abbreviated guest name, no account data. */
export interface OwnerHotelReview {
  MaDanhGia: number;
  DiemDanhGia: number;
  NoiDung: string | null;
  TenNguoiDanhGia: string;
  HinhAnh: string[];
  NgayNhanPhong: string;
  NgayTraPhong: string;
}

export type ScoreDistribution = Record<1 | 2 | 3 | 4 | 5, number>;

export interface OwnerReviewsSummary {
  DiemTrungBinh: number | null;
  SoLuongDanhGia: number;
  /** Always the whole hotel, whatever star filter the list is showing. */
  PhanBoDiem: ScoreDistribution;
}
