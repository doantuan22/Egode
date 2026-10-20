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
  /** Hạn tự hủy khi chờ thanh toán */
  HanThanhToan: string | null;
  /** Số giây còn lại đến hạn theo đồng hồ máy chủ */
  SoGiayConLai: number | null;
}

export interface CreateBookingRequest {
  checkIn: string;
  checkOut: string;
  /** Số khách, máy chủ kiểm tra lại theo sức chứa */
  guests: number;
  rooms: Array<{ maLoaiPhong: number; soLuong: number }>;
  promoCode?: string;
  ghiChu?: string;
}

/** Một dòng lịch sử đặt phòng */
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

/** Chi tiết đơn không có giá từng dòng phòng */
export interface BookingDetail extends Omit<Booking, 'ChiTietPhong'> {
  ChiTietPhong: BookingRoomLine[];
  /** Giờ nhận và trả phòng HH:mm */
  GioNhanPhong: string;
  GioTraPhong: string;
  /** Thời điểm tính hủy và kết thúc lưu trú */
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
