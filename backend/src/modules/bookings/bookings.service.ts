import { randomBytes } from 'node:crypto';
import { BookingsRepository } from './bookings.repository';
import { enumerateNights, priceRoomLine, buildBookedByDate, toDateKey, type NightlyRate } from '../hotels/availability';
import { evaluatePromotion } from '../quotes/promotion-pricing';
import { expireStalePendingBookings, paymentHold } from './booking-expiry';
import { completeFinishedBookings } from './booking-completion';
import { selectRefundPercent, computeRefundAmount } from './refund-policy';
import { AppError } from '../../common/errors/app-error';
import { assertCapacity } from '../hotels/capacity';
import { checkInInstant, checkOutInstant, hoursUntil, timeOfDayOf } from '../../common/utils/business-time';
import { BOOKING_STATUS } from '../../common/constants/hotel-status';
import { getPrismaClient } from '../../config/prisma';
import type { RefundGateway } from '../payments/refund-gateway';
import { ConfiguredRefundGateway } from '../payments/simulated-refund-gateway';
import { RefundsRepository } from '../payments/refunds.repository';
import { RefundProcessor } from '../payments/refund-processor';
import type { CreateBookingInput, CancelBookingInput } from './bookings.schemas';

const toNumber = (value: unknown): number => Number(value);

const generateConfirmationCode = (): string => {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `BK${stamp}${rand}`;
};

export interface BookingRoomLine {
  MaLoaiPhong: number;
  TenLoaiPhong: string;
  SoLuong: number;
  GiaTheoDem: number | null;
  ThanhTien: number | null;
}

export interface BookingResponse {
  MaDatPhong: number;
  MaXacNhanDatPhong: string;
  MaKhachSan: number;
  NgayNhanPhong: string;
  NgayTraPhong: string;
  SoDem: number;
  ChiTietPhong: BookingRoomLine[];
  TongTienPhong: number;
  KhuyenMai: { MaKhuyenMai: number; MaCode: string; LoaiGiamGia: string; GiaTriGiam: number } | null;
  SoTienGiam: number;
  TongTienThanhToan: number;
  TrangThai: string;
  GhiChu: string | null;
  ChinhSachHuy: {
    MaChinhSachHuy: number;
    TenChinhSach: string;
    MoTa: string;
    ChiTiet: Array<{ SoGioTruocNhanPhong: number; TyLeHoanTien: number }>;
  };
  NgayTao: string;
  /** Hạn thanh toán của đơn đang chờ */
  HanThanhToan: string | null;
  /** Số giây còn lại đến hạn thanh toán */
  SoGiayConLai: number | null;
}

export interface MyBookingSummary {
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

export interface PaymentSummary {
  MaThanhToan: number;
  SoTien: number;
  PhuongThucThanhToan: string;
  TrangThai: string;
  ThoiGianGiaoDich: string;
  HoanTien: Array<{
    MaHoanTien: number;
    SoTienHoan: number;
    LyDoHoanTien: string;
    TrangThai: string;
    NgayYeuCau: string;
    NgayHoanTien: string | null;
  }>;
}

export interface BookingDetail extends Omit<BookingResponse, 'ChiTietPhong'> {
  ChiTietPhong: BookingRoomLine[];
  /** Giờ nhận và trả phòng của khách sạn */
  GioNhanPhong: string;
  GioTraPhong: string;
  /** Thời điểm tính hủy và kết thúc lưu trú */
  ThoiDiemNhanPhong: string;
  ThoiDiemTraPhong: string;
  TenKhachSan: string;
  DiaChiChiTiet: string;
  AnhDaiDien: string | null;
  MaTaiKhoanKhachHang: number;
  ThanhToan: PaymentSummary[];
}

export class BookingsService {
  constructor(
    private readonly repository: BookingsRepository = new BookingsRepository(),
    refundGateway: RefundGateway = new ConfiguredRefundGateway(),
    private readonly refunds: RefundsRepository = new RefundsRepository(),
    private readonly refundProcessor: RefundProcessor = new RefundProcessor(refundGateway, refunds),
    /** Mốc tính giờ trước nhận phòng, chỉ test được thay */
    private readonly clock: () => Date = () => new Date()
  ) {}

  async createBooking(
    maKhachSan: number,
    maTaiKhoanKhachHang: number,
    input: CreateBookingInput
  ): Promise<BookingResponse> {
    const hotel = await this.repository.findActiveHotel(maKhachSan);
    if (!hotel) throw AppError.notFound('Không tìm thấy khách sạn');

    const nightKeys = enumerateNights(input.checkIn, input.checkOut);
    const requestedIds = input.rooms.map((r) => r.maLoaiPhong);
    const roomTypes = await this.repository.findActiveRoomTypesByIds(maKhachSan, requestedIds);

    const foundIds = new Set(roomTypes.map((rt) => rt.MaLoaiPhong));
    const missing = requestedIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw AppError.badRequest(
        `Loại phòng không hợp lệ hoặc không thuộc khách sạn này: ${missing.join(', ')}`
      );
    }

    // Kiểm tra sức chứa trước khi khóa
    assertCapacity(
      input.guests,
      input.rooms.map((line) => ({ sucChua: roomTypes.find((rt) => rt.MaLoaiPhong === line.maLoaiPhong)!.SucChua, soLuong: line.soLuong }))
    );

    return this.repository.runInTransaction(async (tx) => {
      // Giải phóng đơn quá hạn trước khi đọc số phòng đã đặt
      await expireStalePendingBookings(tx);

      // Thứ tự khóa: khuyến mãi, quỹ phòng, rồi ghi dữ liệu
      const lockedPromo = input.promoCode ? await this.repository.lockPromotionForBooking(tx, input.promoCode) : null;

      // Tính lại mọi thứ từ CSDL trong giao dịch
      const capacities = new Map((await this.repository.findCapacities(tx, maKhachSan, requestedIds)).map((r) => [r.MaLoaiPhong, r.SucChua]));
      assertCapacity(input.guests, input.rooms.map((line) => ({ sucChua: capacities.get(line.maLoaiPhong) ?? 0, soLuong: line.soLuong })));

      const rateRows = await this.repository.lockRatesForUpdate(tx, requestedIds, input.checkIn, input.checkOut);
      const bookedRows = await this.repository.findBookedQuantities(tx, requestedIds, input.checkIn, input.checkOut);

      const ratesByRoomType = new Map<number, Map<string, NightlyRate>>();
      for (const row of rateRows) {
        if (!ratesByRoomType.has(row.MaLoaiPhong)) ratesByRoomType.set(row.MaLoaiPhong, new Map());
        ratesByRoomType.get(row.MaLoaiPhong)!.set(toDateKey(row.NgayApDung), {
          giaPhong: toNumber(row.GiaPhong),
          soLuongPhong: row.SoLuongPhong,
        });
      }

      const bookedByRoomType = new Map<number, Map<string, number>>();
      const bookedRowsByRoomType = new Map<number, typeof bookedRows>();
      for (const row of bookedRows) {
        if (!bookedRowsByRoomType.has(row.MaLoaiPhong)) bookedRowsByRoomType.set(row.MaLoaiPhong, []);
        bookedRowsByRoomType.get(row.MaLoaiPhong)!.push(row);
      }
      for (const [maLoaiPhong, rows] of bookedRowsByRoomType) {
        bookedByRoomType.set(
          maLoaiPhong,
          buildBookedByDate(rows.map((r) => ({ ngayNhanPhong: r.NgayNhanPhong, ngayTraPhong: r.NgayTraPhong, soLuongPhong: r.SoLuongPhong })))
        );
      }

      const chiTietPhong = input.rooms.map((line) => {
        const roomType = roomTypes.find((rt) => rt.MaLoaiPhong === line.maLoaiPhong)!;
        const ratesByDate = ratesByRoomType.get(line.maLoaiPhong) ?? new Map();
        const bookedByDate = bookedByRoomType.get(line.maLoaiPhong) ?? new Map();
        const pricing = priceRoomLine(nightKeys, ratesByDate, bookedByDate, line.soLuong);
        return {
          maLoaiPhong: line.maLoaiPhong,
          tenLoaiPhong: roomType.TenLoaiPhong,
          soLuong: line.soLuong,
          ...pricing,
        };
      });

      const unavailable = chiTietPhong.filter((l) => !l.duPhong || !l.coGiaDayDu);
      if (unavailable.length > 0) {
        const names = unavailable.map((l) => l.tenLoaiPhong).join(', ');
        throw AppError.conflict(`Không còn đủ phòng hoặc thiếu giá cho: ${names}. Vui lòng thử lại với lựa chọn khác.`);
      }

      const tongTienPhong = chiTietPhong.reduce((sum, l) => sum + (l.thanhTien ?? 0), 0);

      let khuyenMai: BookingResponse['KhuyenMai'] = null;
      let soTienGiam = 0;

      if (lockedPromo) {
        const promo = lockedPromo;
        const usedCount = promo.DaDung;
        const evalResult = evaluatePromotion(
          {
            MaKhuyenMai: promo.MaKhuyenMai,
            MaCode: promo.MaCode,
            LoaiGiamGia: promo.LoaiGiamGia,
            GiaTriGiam: toNumber(promo.GiaTriGiam),
            GiaTriDonToiThieu: toNumber(promo.GiaTriDonToiThieu),
            MucGiamToiDa: toNumber(promo.MucGiamToiDa),
            SoLuongGioiHan: promo.SoLuongGioiHan,
            NgayBatDau: promo.NgayBatDau,
            NgayKetThuc: promo.NgayKetThuc,
            TrangThai: promo.TrangThai,
          },
          tongTienPhong,
          new Date(),
          usedCount
        );

        // Đặt phòng từ chối khi mã khuyến mãi không áp dụng được
        if (!evalResult.valid) {
          throw AppError.badRequest(evalResult.reason ?? 'Mã khuyến mãi không hợp lệ');
        }

        khuyenMai = {
          MaKhuyenMai: promo.MaKhuyenMai,
          MaCode: promo.MaCode,
          LoaiGiamGia: promo.LoaiGiamGia,
          GiaTriGiam: toNumber(promo.GiaTriGiam),
        };
        soTienGiam = evalResult.discount;
      }

      const tongTienThanhToan = tongTienPhong - soTienGiam;

      // Tổng bằng 0 thì xác nhận đơn ngay
      const trangThai = tongTienThanhToan === 0 ? BOOKING_STATUS.CONFIRMED : BOOKING_STATUS.PENDING_PAYMENT;

      const policy = await this.repository.findActiveCancellationPolicy(tx);
      if (!policy) {
        throw AppError.internal('Chưa có chính sách hủy nào đang hoạt động trong hệ thống');
      }

      const maXacNhanDatPhong = generateConfirmationCode();
      const booking = await this.repository.insertBooking(tx, {
        maXacNhanDatPhong,
        maTaiKhoanKhachHang,
        maKhachSan,
        maKhuyenMai: khuyenMai?.MaKhuyenMai ?? null,
        maChinhSachHuy: policy.MaChinhSachHuy,
        ngayNhanPhong: input.checkIn,
        ngayTraPhong: input.checkOut,
        tongTienPhong,
        soTienGiam,
        tongTienThanhToan,
        ghiChu: input.ghiChu ?? null,
        trangThai,
      });

      await this.repository.insertBookingLines(
        tx,
        booking.MaDatPhong,
        chiTietPhong.map((l) => ({ maLoaiPhong: l.maLoaiPhong, soLuong: l.soLuong }))
      );

      return {
        MaDatPhong: booking.MaDatPhong,
        MaXacNhanDatPhong: booking.MaXacNhanDatPhong,
        MaKhachSan: maKhachSan,
        NgayNhanPhong: input.checkIn.toISOString().slice(0, 10),
        NgayTraPhong: input.checkOut.toISOString().slice(0, 10),
        SoDem: nightKeys.length,
        ChiTietPhong: chiTietPhong.map((l) => ({
          MaLoaiPhong: l.maLoaiPhong,
          TenLoaiPhong: l.tenLoaiPhong,
          SoLuong: l.soLuong,
          GiaTheoDem: l.giaTheoDem,
          ThanhTien: l.thanhTien,
        })),
        TongTienPhong: tongTienPhong,
        KhuyenMai: khuyenMai,
        SoTienGiam: soTienGiam,
        TongTienThanhToan: tongTienThanhToan,
        TrangThai: booking.TrangThai,
        GhiChu: booking.GhiChu,
        ChinhSachHuy: {
          MaChinhSachHuy: policy.MaChinhSachHuy,
          TenChinhSach: policy.TenChinhSach,
          MoTa: policy.MoTa,
          ChiTiet: policy.CHI_TIET_CHINH_SACH_HUY.map((c) => ({
            SoGioTruocNhanPhong: c.SoGioTruocNhanPhong,
            TyLeHoanTien: toNumber(c.TyLeHoanTien),
          })),
        },
        NgayTao: booking.NgayTao.toISOString(),
        ...paymentHold(booking.NgayTao, booking.TrangThai),
      };
    });
  }

  async listMyBookings(maTaiKhoanKhachHang: number): Promise<MyBookingSummary[]> {
    await expireStalePendingBookings(getPrismaClient());
    await completeFinishedBookings(getPrismaClient());
    const rows = await this.repository.listByCustomer(maTaiKhoanKhachHang);
    return rows.map((b) => ({
      MaDatPhong: b.MaDatPhong,
      MaXacNhanDatPhong: b.MaXacNhanDatPhong,
      TenKhachSan: b.KHACH_SAN.TenKhachSan,
      DiaChiChiTiet: b.KHACH_SAN.DiaChiChiTiet,
      AnhDaiDien: b.KHACH_SAN.HINH_ANH_KHACH_SAN[0]?.URL ?? null,
      NgayNhanPhong: b.NgayNhanPhong.toISOString().slice(0, 10),
      NgayTraPhong: b.NgayTraPhong.toISOString().slice(0, 10),
      TongTienThanhToan: toNumber(b.TongTienThanhToan),
      TrangThai: b.TrangThai,
      NgayTao: b.NgayTao.toISOString(),
    }));
  }

  async getBookingDetail(maDatPhong: number, requesterId: number): Promise<BookingDetail> {
    await expireStalePendingBookings(getPrismaClient());
    await completeFinishedBookings(getPrismaClient());
    const booking = await this.repository.findDetailById(maDatPhong);
    if (!booking) throw AppError.notFound('Không tìm thấy đặt phòng');
    if (booking.MaTaiKhoanKhachHang !== requesterId) {
      throw AppError.forbidden('Bạn không có quyền xem đặt phòng này');
    }
    return this.toBookingDetail(booking);
  }

  async cancelBooking(
    maDatPhong: number,
    requesterId: number,
    input: CancelBookingInput,
    ipAddr: string
  ): Promise<BookingDetail> {
    await expireStalePendingBookings(getPrismaClient());
    await completeFinishedBookings(getPrismaClient());
    const booking = await this.repository.findDetailById(maDatPhong);
    if (!booking) throw AppError.notFound('Không tìm thấy đặt phòng');
    if (booking.MaTaiKhoanKhachHang !== requesterId) {
      throw AppError.forbidden('Bạn không có quyền hủy đặt phòng này');
    }
    if (booking.TrangThai !== BOOKING_STATUS.PENDING_PAYMENT && booking.TrangThai !== BOOKING_STATUS.CONFIRMED) {
      throw AppError.badRequest(`Không thể hủy đặt phòng ở trạng thái "${booking.TrangThai}"`);
    }

    const now = new Date();
    // Thời điểm nhận phòng dùng để tính mức hoàn tiền
    const hoursBeforeCheckIn = hoursUntil(checkInInstant(booking.NgayNhanPhong, booking.KHACH_SAN.GioNhanPhong), this.clock());
    const tiers = booking.CHINH_SACH_HUY.CHI_TIET_CHINH_SACH_HUY.map((c) => ({
      soGioTruocNhanPhong: c.SoGioTruocNhanPhong,
      tyLeHoanTien: toNumber(c.TyLeHoanTien),
    }));
    const refundPercent = selectRefundPercent(tiers, hoursBeforeCheckIn);
    const note = input.ghiChu ? `Khách hủy đặt phòng: ${input.ghiChu}` : 'Khách hủy đặt phòng';

    // Giai đoạn 1: hủy đơn và tạo yêu cầu hoàn tiền trong một giao dịch
    const pendingRefund = await this.repository.runInTransaction(async (tx) => {
      const affected = await this.repository.cancelBooking(tx, maDatPhong, note, now);
      if (affected === 0) {
        throw AppError.conflict('Đặt phòng đã đổi trạng thái trước đó (có thể đã bị hủy hoặc hết hạn) — vui lòng tải lại');
      }

      // Không có thanh toán thành công thì không hoàn tiền
      const successPayment = await this.refunds.lockSuccessfulPayment(tx, maDatPhong);
      if (!successPayment) return null;

      const refundAmount = computeRefundAmount(toNumber(successPayment.SoTien), refundPercent);
      if (refundAmount <= 0) return null;

      return this.refunds.openPendingRefund(
        tx,
        successPayment,
        refundAmount,
        `Hủy đặt phòng — hoàn ${refundPercent}% theo chính sách hủy (${hoursBeforeCheckIn.toFixed(1)}h trước nhận phòng)`,
        now
      );
    });

    // Giai đoạn 2: gọi cổng hoàn tiền sau khi giao dịch đã commit
    if (pendingRefund) await this.refundProcessor.process(pendingRefund, ipAddr);

    return this.getBookingDetail(maDatPhong, requesterId);
  }

  private toBookingDetail(
    booking: NonNullable<Awaited<ReturnType<BookingsRepository['findDetailById']>>>
  ): BookingDetail {
    const chiTietPhong: BookingRoomLine[] = booking.CHI_TIET_DAT_PHONG.map((c) => ({
      MaLoaiPhong: c.MaLoaiPhong,
      TenLoaiPhong: c.LOAI_PHONG.TenLoaiPhong,
      SoLuong: c.SoLuongPhong,
      GiaTheoDem: null,
      ThanhTien: null,
    }));

    return {
      MaDatPhong: booking.MaDatPhong,
      MaXacNhanDatPhong: booking.MaXacNhanDatPhong,
      MaKhachSan: booking.MaKhachSan,
      TenKhachSan: booking.KHACH_SAN.TenKhachSan,
      DiaChiChiTiet: booking.KHACH_SAN.DiaChiChiTiet,
      AnhDaiDien: booking.KHACH_SAN.HINH_ANH_KHACH_SAN[0]?.URL ?? null,
      MaTaiKhoanKhachHang: booking.MaTaiKhoanKhachHang,
      GioNhanPhong: timeOfDayOf(booking.KHACH_SAN.GioNhanPhong),
      GioTraPhong: timeOfDayOf(booking.KHACH_SAN.GioTraPhong),
      ThoiDiemNhanPhong: checkInInstant(booking.NgayNhanPhong, booking.KHACH_SAN.GioNhanPhong).toISOString(),
      ThoiDiemTraPhong: checkOutInstant(booking.NgayTraPhong, booking.KHACH_SAN.GioTraPhong).toISOString(),
      NgayNhanPhong: booking.NgayNhanPhong.toISOString().slice(0, 10),
      NgayTraPhong: booking.NgayTraPhong.toISOString().slice(0, 10),
      SoDem: enumerateNights(booking.NgayNhanPhong, booking.NgayTraPhong).length,
      ChiTietPhong: chiTietPhong,
      TongTienPhong: toNumber(booking.TongTienPhong),
      KhuyenMai: booking.KHUYEN_MAI
        ? {
            MaKhuyenMai: booking.KHUYEN_MAI.MaKhuyenMai,
            MaCode: booking.KHUYEN_MAI.MaCode,
            LoaiGiamGia: booking.KHUYEN_MAI.LoaiGiamGia,
            GiaTriGiam: toNumber(booking.KHUYEN_MAI.GiaTriGiam),
          }
        : null,
      SoTienGiam: toNumber(booking.SoTienGiam),
      TongTienThanhToan: toNumber(booking.TongTienThanhToan),
      TrangThai: booking.TrangThai,
      GhiChu: booking.GhiChu,
      ChinhSachHuy: {
        MaChinhSachHuy: booking.CHINH_SACH_HUY.MaChinhSachHuy,
        TenChinhSach: booking.CHINH_SACH_HUY.TenChinhSach,
        MoTa: booking.CHINH_SACH_HUY.MoTa,
        ChiTiet: booking.CHINH_SACH_HUY.CHI_TIET_CHINH_SACH_HUY.map((c) => ({
          SoGioTruocNhanPhong: c.SoGioTruocNhanPhong,
          TyLeHoanTien: toNumber(c.TyLeHoanTien),
        })),
      },
      NgayTao: booking.NgayTao.toISOString(),
      ...paymentHold(booking.NgayTao, booking.TrangThai),
      ThanhToan: booking.THANH_TOAN.map((t) => ({
        MaThanhToan: t.MaThanhToan,
        SoTien: toNumber(t.SoTien),
        PhuongThucThanhToan: t.PhuongThucThanhToan,
        TrangThai: t.TrangThai,
        ThoiGianGiaoDich: t.ThoiGianGiaoDich.toISOString(),
        HoanTien: t.HOAN_TIEN.map((h) => ({
          MaHoanTien: h.MaHoanTien,
          SoTienHoan: toNumber(h.SoTienHoan),
          LyDoHoanTien: h.LyDoHoanTien,
          TrangThai: h.TrangThai,
          NgayYeuCau: h.NgayYeuCau.toISOString(),
          NgayHoanTien: h.NgayHoanTien ? h.NgayHoanTien.toISOString() : null,
        })),
      })),
    };
  }
}
