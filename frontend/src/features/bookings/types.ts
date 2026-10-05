export interface BookingRoomLine {
  MaLoaiPhong: number;
  TenLoaiPhong: string;
  SoLuong: number;
  GiaTheoDem: number | null;
  ThanhTien: number | null;
}

export interface BookingPromotion {
  MaKhuyenMai: number;
  MaCode: string;
  LoaiGiamGia: string;
  GiaTriGiam: number;
}

export interface BookingCancellationPolicy {
  MaChinhSachHuy: number;
  TenChinhSach: string;
  MoTa: string;
  ChiTiet: Array<{ SoGioTruocNhanPhong: number; TyLeHoanTien: number }>;
}

export interface Booking {
  MaDatPhong: number;
  MaXacNhanDatPhong: string;
  MaKhachSan: number;
  NgayNhanPhong: string;
  NgayTraPhong: string;
  SoDem: number;
  ChiTietPhong: BookingRoomLine[];
  TongTienPhong: number;
  KhuyenMai: BookingPromotion | null;
  SoTienGiam: number;
  TongTienThanhToan: number;
  TrangThai: string;
  GhiChu: string | null;
  ChinhSachHuy: BookingCancellationPolicy;
  NgayTao: string;
  /** While "Chờ thanh toán": when the booking is auto-cancelled (ISO). Null in any other status. */
  HanThanhToan: string | null;
  /** Seconds until HanThanhToan by the SERVER clock at the time of the response; null when there is no hold. */
  SoGiayConLai: number | null;
}

export interface CreateBookingRequest {
  checkIn: string;
  checkOut: string;
  /** Party size (not stored): the server re-checks it against the capacity of the chosen rooms. */
  guests: number;
  rooms: Array<{ maLoaiPhong: number; soLuong: number }>;
  promoCode?: string;
  ghiChu?: string;
}

/** One row of GET /bookings (own history, newest first). */
export interface BookingSummary {
  MaDatPhong: number;
  MaXacNhanDatPhong: string;
  TenKhachSan: string;
  DiaChiChiTiet: string;
  AnhDaiDien: string | null;
  NgayNhanPhong: string;
  NgayTraPhong: string;
  TongTienThanhToan: number;
  TrangThai: string;
  NgayTao: string;
}

export interface RefundView {
  MaHoanTien: number;
  SoTienHoan: number;
  LyDoHoanTien: string;
  TrangThai: string;
  NgayYeuCau: string;
  NgayHoanTien: string | null;
}

export interface PaymentView {
  MaThanhToan: number;
  SoTien: number;
  PhuongThucThanhToan: string;
  TrangThai: string;
  ThoiGianGiaoDich: string;
  HoanTien: RefundView[];
}

/**
 * GET /bookings/:id — ChiTietPhong.GiaTheoDem/ThanhTien are always null here
 * (unlike the just-created Booking above): CHI_TIET_DAT_PHONG only stores
 * MaLoaiPhong + SoLuongPhong, no per-line historical price snapshot (Gate 0
 * — no CHI_TIET_GIA_DAT_PHONG table), so only the DAT_PHONG-level totals
 * (TongTienPhong/SoTienGiam/TongTienThanhToan) are ever reconstructable
 * later. Render room lines as "name × qty" only, never a per-line price.
 */
export interface BookingDetail extends Omit<Booking, 'ChiTietPhong'> {
  ChiTietPhong: BookingRoomLine[];
  /** Hotel check-in / check-out wall-clock times in Vietnam time, "HH:mm". */
  GioNhanPhong: string;
  GioTraPhong: string;
  /** The instants (ISO, UTC) the cancellation tiers are measured to and the stay ends at. */
  ThoiDiemNhanPhong: string;
  ThoiDiemTraPhong: string;
  TenKhachSan: string;
  DiaChiChiTiet: string;
  AnhDaiDien: string | null;
  MaTaiKhoanKhachHang: number;
  ThanhToan: PaymentView[];
}

export interface CancelBookingRequest {
  ghiChu?: string;
}
