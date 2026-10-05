import { AppError } from '../../common/errors/app-error';
import { OwnerHotelsService } from './owner-hotels.service';
import { OwnerBookingsRepository } from './owner-bookings.repository';
import { reconcileBookingLifecycle } from '../bookings/booking-lifecycle';
import type { OwnerBookingsQuery } from './owner-bookings.schemas';

const toNumber = (value: unknown) => Number(value);

export class OwnerBookingsService {
  constructor(private readonly repository: OwnerBookingsRepository = new OwnerBookingsRepository(), private readonly hotels: OwnerHotelsService = new OwnerHotelsService()) {}

  private map(booking: NonNullable<Awaited<ReturnType<OwnerBookingsRepository['findForHotel']>>>) {
    return {
      MaDatPhong: booking.MaDatPhong, MaXacNhanDatPhong: booking.MaXacNhanDatPhong,
      KhachHang: booking.TAI_KHOAN, NgayNhanPhong: booking.NgayNhanPhong.toISOString().slice(0, 10), NgayTraPhong: booking.NgayTraPhong.toISOString().slice(0, 10),
      TongTienThanhToan: toNumber(booking.TongTienThanhToan), TrangThai: booking.TrangThai, NgayTao: booking.NgayTao.toISOString(),
      GhiChu: booking.GhiChu,
      GioNhanPhong: booking.KHACH_SAN.GioNhanPhong.toISOString(), GioTraPhong: booking.KHACH_SAN.GioTraPhong.toISOString(),
      ChiTietPhong: booking.CHI_TIET_DAT_PHONG.map((line) => ({ MaLoaiPhong: line.MaLoaiPhong, TenLoaiPhong: line.LOAI_PHONG.TenLoaiPhong, SoLuong: line.SoLuongPhong })),
      ThanhToan: booking.THANH_TOAN.map((payment) => ({ MaThanhToan: payment.MaThanhToan, TrangThai: payment.TrangThai, PhuongThucThanhToan: payment.PhuongThucThanhToan, SoTien: toNumber(payment.SoTien), ThoiGianGiaoDich: payment.ThoiGianGiaoDich.toISOString() })),
    };
  }

  /**
   * BUG-008: booking status changes lazily (no cron) — a "Chờ thanh toán" booking past its
   * payment hold becomes "Đã hủy", a "Đã xác nhận" one past check-out becomes "Hoàn tất" —
   * so every read that shows a status must run the same two sweeps the customer-facing
   * BookingsService runs, in the same order. Call it only AFTER the ownership check: both
   * sweeps are system-wide UPDATEs and a rejected request must not trigger them.
   */
  private async refreshBookingLifecycle(): Promise<void> {
    await reconcileBookingLifecycle();
  }

  async list(ownerId: number, hotelId: number, query: OwnerBookingsQuery) {
    await this.hotels.getOwnedHotel(ownerId, hotelId);
    await this.refreshBookingLifecycle();
    const { items, total } = await this.repository.listForHotel(hotelId, query);
    return { items: items.map((item) => this.map(item)), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) } };
  }

  async getOne(ownerId: number, hotelId: number, bookingId: number) {
    await this.hotels.getOwnedHotel(ownerId, hotelId);
    await this.refreshBookingLifecycle();
    const booking = await this.repository.findForHotel(hotelId, bookingId);
    if (!booking) throw AppError.notFound('Không tìm thấy đặt phòng thuộc khách sạn này');
    return this.map(booking);
  }
}
