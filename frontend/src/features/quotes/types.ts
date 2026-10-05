export interface QuoteRoomLine {
  MaLoaiPhong: number;
  TenLoaiPhong: string;
  SoLuongYeuCau: number;
  SoPhongConLai: number;
  DuPhong: boolean;
  CoGiaDayDu: boolean;
  GiaTheoDem: number | null;
  ThanhTien: number | null;
}

export interface QuotePromotion {
  MaKhuyenMai: number;
  MaCode: string;
  LoaiGiamGia: string;
  GiaTriGiam: number;
}

export interface QuoteCancellationPolicy {
  MaChinhSachHuy: number;
  TenChinhSach: string;
  MoTa: string;
  ChiTiet: Array<{ SoGioTruocNhanPhong: number; TyLeHoanTien: number }>;
}

export interface Quote {
  MaKhachSan: number;
  NgayNhanPhong: string;
  NgayTraPhong: string;
  SoDem: number;
  ChiTietPhong: QuoteRoomLine[];
  KhaDung: boolean;
  /** The party size the quote was checked for and what the chosen rooms can hold. */
  SoKhach?: number;
  TongSucChua?: number;
  TongTienPhong: number;
  KhuyenMai: QuotePromotion | null;
  SoTienGiam: number;
  TongTienThanhToan: number;
  PromoHopLe: boolean;
  PromoThongBao: string | null;
  ChinhSachHuy: QuoteCancellationPolicy | null;
}

export interface QuoteRequest {
  checkIn: string;
  checkOut: string;
  /** Party size; the server checks it against the capacity of the chosen rooms. */
  guests: number;
  rooms: Array<{ maLoaiPhong: number; soLuong: number }>;
  promoCode?: string;
}
