import { OwnerHotelsService } from './owner-hotels.service';
import { reconcileBookingLifecycle } from '../bookings/booking-lifecycle';
import { AnalyticsRepository } from '../analytics/analytics.repository';
import { toExclusiveEnd } from '../analytics/date-range';
import type { DateRangeQuery } from '../analytics/date-range';

const toIsoDate = (d?: Date): string | null => (d ? d.toISOString().slice(0, 10) : null);

export class OwnerAnalyticsService {
  constructor(
    private readonly ownerHotelsService: OwnerHotelsService = new OwnerHotelsService(),
    private readonly analytics: AnalyticsRepository = new AnalyticsRepository()
  ) {}

  /** Kiểm tra quyền sở hữu trước khi thống kê */
  async getHotelAnalytics(ownerId: number, maKhachSan: number, query: DateRangeQuery) {
    await this.ownerHotelsService.getOwnedHotel(ownerId, maKhachSan);
    await reconcileBookingLifecycle();

    const scope = { maKhachSan, from: query.from, to: query.to ? toExclusiveEnd(query.to) : undefined };

    const [bookingsByStatus, doanhThuGop, tongHoanTien, loaiPhongPhoBien, occupancy] = await Promise.all([
      this.analytics.countBookingsByStatus(scope),
      this.analytics.sumSuccessfulPayments(scope),
      this.analytics.sumSuccessfulRefunds(scope),
      this.analytics.topRoomTypes(scope, 5),
      this.analytics.occupancy(scope),
    ]);

    return {
      MaKhachSan: maKhachSan,
      From: toIsoDate(query.from),
      To: toIsoDate(query.to),
      TongSoBooking: bookingsByStatus.reduce((sum, b) => sum + b.SoLuong, 0),
      BookingTheoTrangThai: bookingsByStatus,
      DoanhThuGop: doanhThuGop,
      TongHoanTien: tongHoanTien,
      DoanhThuThucNhan: doanhThuGop - tongHoanTien,
      LoaiPhongPhoBien: loaiPhongPhoBien,
      TyLeLapDay: occupancy.TyLeLapDay,
      TongPhongDem: occupancy.TongPhongDem,
      TongPhongCoTheBan: occupancy.TongPhongCoTheBan,
    };
  }
}
