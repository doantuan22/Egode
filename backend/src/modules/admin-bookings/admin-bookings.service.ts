import { AppError } from '../../common/errors/app-error';
import { dateKeyOf, timeOfDayOf } from '../../common/utils/business-time';
import { reconcileBookingLifecycle } from '../bookings/booking-lifecycle';
import { AdminBookingsRepository } from './admin-bookings.repository';
import type { AdminBookingsQuery } from './admin-bookings.schemas';

const toNumber = (value: unknown): number => Number(value);

export class AdminBookingsService {
  constructor(private readonly repository = new AdminBookingsRepository()) {}

  private mapListItem(booking: Awaited<ReturnType<AdminBookingsRepository['list']>>['items'][number]) {
    return {
      MaDatPhong: booking.MaDatPhong,
      MaXacNhanDatPhong: booking.MaXacNhanDatPhong,
      KhachHang: booking.TAI_KHOAN,
      KhachSan: booking.KHACH_SAN,
      NgayNhanPhong: dateKeyOf(booking.NgayNhanPhong),
      NgayTraPhong: dateKeyOf(booking.NgayTraPhong),
      TongSoPhong: booking.CHI_TIET_DAT_PHONG.reduce((sum, line) => sum + line.SoLuongPhong, 0),
      TongTienThanhToan: toNumber(booking.TongTienThanhToan),
      TrangThai: booking.TrangThai,
      NgayTao: booking.NgayTao.toISOString(),
    };
  }

  async list(query: AdminBookingsQuery) {
    await reconcileBookingLifecycle();
    const { items, total } = await this.repository.list(query);
    return {
      items: items.map((item) => this.mapListItem(item)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getOne(id: number) {
    await reconcileBookingLifecycle();
    const booking = await this.repository.findById(id);
    if (!booking) throw AppError.notFound('Không tìm thấy đặt phòng');

    return {
      MaDatPhong: booking.MaDatPhong,
      MaXacNhanDatPhong: booking.MaXacNhanDatPhong,
      KhachHang: booking.TAI_KHOAN,
      KhachSan: {
        MaKhachSan: booking.KHACH_SAN.MaKhachSan,
        TenKhachSan: booking.KHACH_SAN.TenKhachSan,
        DiaChiChiTiet: booking.KHACH_SAN.DiaChiChiTiet,
        GioNhanPhong: timeOfDayOf(booking.KHACH_SAN.GioNhanPhong),
        GioTraPhong: timeOfDayOf(booking.KHACH_SAN.GioTraPhong),
      },
      NgayNhanPhong: dateKeyOf(booking.NgayNhanPhong),
      NgayTraPhong: dateKeyOf(booking.NgayTraPhong),
      TongTienPhong: toNumber(booking.TongTienPhong),
      SoTienGiam: toNumber(booking.SoTienGiam),
      TongTienThanhToan: toNumber(booking.TongTienThanhToan),
      GhiChu: booking.GhiChu,
      TrangThai: booking.TrangThai,
      NgayTao: booking.NgayTao.toISOString(),
      NgayCapNhat: booking.NgayCapNhat.toISOString(),
      ChiTietPhong: booking.CHI_TIET_DAT_PHONG.map((line) => ({
        MaLoaiPhong: line.MaLoaiPhong,
        TenLoaiPhong: line.LOAI_PHONG.TenLoaiPhong,
        SoLuong: line.SoLuongPhong,
      })),
      KhuyenMai: booking.KHUYEN_MAI ? {
        MaKhuyenMai: booking.KHUYEN_MAI.MaKhuyenMai,
        MaCode: booking.KHUYEN_MAI.MaCode,
        LoaiGiamGia: booking.KHUYEN_MAI.LoaiGiamGia,
        GiaTriGiam: toNumber(booking.KHUYEN_MAI.GiaTriGiam),
      } : null,
      ChinhSachHuy: {
        MaChinhSachHuy: booking.CHINH_SACH_HUY.MaChinhSachHuy,
        TenChinhSach: booking.CHINH_SACH_HUY.TenChinhSach,
        MoTa: booking.CHINH_SACH_HUY.MoTa,
        ChiTiet: booking.CHINH_SACH_HUY.CHI_TIET_CHINH_SACH_HUY.map((tier) => ({
          SoGioTruocNhanPhong: tier.SoGioTruocNhanPhong,
          TyLeHoanTien: toNumber(tier.TyLeHoanTien),
        })),
      },
      ThanhToan: booking.THANH_TOAN.map((payment) => ({
        MaThanhToan: payment.MaThanhToan,
        SoTien: toNumber(payment.SoTien),
        PhuongThucThanhToan: payment.PhuongThucThanhToan,
        MaGiaoDichDoiTac: payment.MaGiaoDichDoiTac,
        TrangThai: payment.TrangThai,
        ThoiGianGiaoDich: payment.ThoiGianGiaoDich.toISOString(),
        HoanTien: payment.HOAN_TIEN.map((refund) => ({
          MaHoanTien: refund.MaHoanTien,
          SoTienHoan: toNumber(refund.SoTienHoan),
          LyDoHoanTien: refund.LyDoHoanTien,
          TrangThai: refund.TrangThai,
          NgayYeuCau: refund.NgayYeuCau.toISOString(),
          NgayHoanTien: refund.NgayHoanTien?.toISOString() ?? null,
        })),
      })),
    };
  }
}
