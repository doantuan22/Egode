export interface ReviewImage {
  MaHinhAnhDanhGia: number;
  URL: string;
}

export interface Review {
  MaDanhGia: number;
  MaDatPhong: number;
  MaKhachHang: number;
  MaKhachSan: number;
  DiemDanhGia: number;
  NoiDung: string | null;
  TrangThai: string;
  HINH_ANH_DANH_GIA: ReviewImage[];
}

/** One review as the public sees it (GET /hotels/:id/reviews): abbreviated name, no account or booking data. */
export interface PublicReview {
  MaDanhGia: number;
  DiemDanhGia: number;
  NoiDung: string | null;
  TenNguoiDanhGia: string;
  HinhAnh: string[];
}

/** Average and count of the VISIBLE reviews only. */
export interface RatingSummary {
  DiemTrungBinh: number | null;
  SoLuongDanhGia: number;
}

export interface AdminReviewListItem extends Review {
  TAI_KHOAN: { MaTaiKhoan: number; HoTen: string; Email: string };
  KHACH_SAN: { MaKhachSan: number; TenKhachSan: string };
}

export interface AdminReviewDetail extends AdminReviewListItem {
  DAT_PHONG: { MaDatPhong: number; MaXacNhanDatPhong: string; NgayNhanPhong: string; NgayTraPhong: string };
}

export interface CreateReviewRequest {
  diemDanhGia: number;
  noiDung?: string;
  hinhAnh?: string[];
}

export interface AdminReviewListQuery {
  page?: number;
  limit?: number;
  search?: string;
  trangThai?: string;
  diemDanhGia?: number;
}
