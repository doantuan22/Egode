export interface DiaPhuong {
  MaDiaPhuong: number;
  TenThanhPho: string;
  TenTinh: string;
  QuocGia: string;
}

/** GET /api/locations row — DiaPhuong plus its count of publicly listed hotels and a cover image. */
export interface LocationSummary extends DiaPhuong {
  SoKhachSan: number;
  AnhDaiDien: string | null;
}

export interface Amenity {
  MaTienNghi: number;
  TenTienNghi: string;
  BieuTuong: string | null;
}

export interface HotelSearchItem {
  MaKhachSan: number;
  TenKhachSan: string;
  DiaChiChiTiet: string;
  HangSao: number;
  DiaPhuong: DiaPhuong;
  AnhDaiDien: string | null;
  GiaTuDauTu: number | null;
  ConPhong: boolean;
  /** Visible reviews only; null average = no review yet. */
  DiemTrungBinh?: number | null;
  SoLuongDanhGia?: number;
}

export interface HotelDetail {
  MaKhachSan: number;
  TenKhachSan: string;
  DiaChiChiTiet: string;
  MoTa: string | null;
  HangSao: number;
  GioNhanPhong: string;
  GioTraPhong: string;
  DanhGia?: { DiemTrungBinh: number | null; SoLuongDanhGia: number };
  DiaPhuong: DiaPhuong;
  HinhAnh: Array<{ MaHinhAnh: number; URL: string; AnhDaiDien: boolean }>;
  TienNghi: Amenity[];
}

export interface RoomTypeWithAvailability {
  MaLoaiPhong: number;
  TenLoaiPhong: string;
  SoGiuong: number;
  SucChua: number;
  DienTich: number;
  LoaiGiuong: string;
  MoTa: string | null;
  HinhAnh: Array<{ MaHinhAnhLoaiPhong: number; URL: string; LaAnhDaiDien: boolean }>;
  TienNghi: Amenity[];
  GiaTheoDem: number | null;
  TongTien: number | null;
  SoDem: number;
  SoPhongConLai: number;
  ConHang: boolean;
}

export type SortOption = 'price_asc' | 'price_desc' | 'star_desc' | 'newest';

export interface HotelSearchParams {
  location?: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  minPrice?: number;
  maxPrice?: number;
  starRating?: number;
  amenities?: number[];
  page: number;
  limit: number;
  sort: SortOption;
}

export interface RoomsQueryParams {
  checkIn: string;
  checkOut: string;
  guests?: number;
}
