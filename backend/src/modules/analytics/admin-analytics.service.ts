import { AnalyticsRepository } from './analytics.repository';
import { AdminAnalyticsRepository } from './admin-analytics.repository';
import { toExclusiveEnd } from './date-range';
import { reconcileBookingLifecycle } from '../bookings/booking-lifecycle';
import type { DateRangeQuery } from './date-range';

const toIsoDate = (d?: Date): string | null => (d ? d.toISOString().slice(0, 10) : null);

export class AdminAnalyticsService {
  constructor(
    private readonly analytics: AnalyticsRepository = new AnalyticsRepository(),
    private readonly adminAnalytics: AdminAnalyticsRepository = new AdminAnalyticsRepository()
  ) {}

  async getSystemAnalytics(query: DateRangeQuery) {
    await reconcileBookingLifecycle();
    const range = { from: query.from, to: query.to ? toExclusiveEnd(query.to) : undefined };

    const [
      bookingsByStatus,
      doanhThuGop,
      tongHoanTien,
      loaiPhongPhoBien,
      taiKhoanTheoVaiTro,
      khachSanTheoTrangThai,
      thanhToanTheoTrangThai,
      hoanTienTheoTrangThai,
      danhGiaTheoTrangThai,
      yeuCauHoTroTheoTrangThai,
    ] = await Promise.all([
      this.analytics.countBookingsByStatus(range),
      this.analytics.sumSuccessfulPayments(range),
      this.analytics.sumSuccessfulRefunds(range),
      this.analytics.topRoomTypes(range, 5),
      this.adminAnalytics.countAccountsByRole(),
      this.adminAnalytics.countHotelsByStatus(),
      this.adminAnalytics.countPaymentsByStatus(range),
      this.adminAnalytics.countRefundsByStatus(range),
      this.adminAnalytics.countReviewsByStatus(),
      this.adminAnalytics.countSupportByStatus(range),
    ]);

    return {
      From: toIsoDate(query.from),
      To: toIsoDate(query.to),
      TongTaiKhoan: taiKhoanTheoVaiTro.reduce((sum, r) => sum + r.SoLuong, 0),
      TaiKhoanTheoVaiTro: taiKhoanTheoVaiTro,
      TongKhachSan: khachSanTheoTrangThai.reduce((sum, r) => sum + r.SoLuong, 0),
      KhachSanTheoTrangThai: khachSanTheoTrangThai,
      TongSoBooking: bookingsByStatus.reduce((sum, b) => sum + b.SoLuong, 0),
      BookingTheoTrangThai: bookingsByStatus,
      LoaiPhongPhoBien: loaiPhongPhoBien,
      TongGiaoDich: thanhToanTheoTrangThai.reduce((sum, r) => sum + r.SoLuong, 0),
      ThanhToanTheoTrangThai: thanhToanTheoTrangThai,
      DoanhThuHeThong: doanhThuGop,
      TongHoanTien: tongHoanTien,
      DoanhThuThucNhan: doanhThuGop - tongHoanTien,
      HoanTienTheoTrangThai: hoanTienTheoTrangThai,
      DanhGiaTheoTrangThai: danhGiaTheoTrangThai,
      YeuCauHoTroTheoTrangThai: yeuCauHoTroTheoTrangThai,
    };
  }
}
