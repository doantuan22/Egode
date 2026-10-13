import { getPrismaClient } from '../../config/prisma';
import { AppError } from '../../common/errors/app-error';
import { BOOKING_STATUS, HOTEL_STATUS } from '../../common/constants/hotel-status';
import { checkInInstant } from '../../common/utils/business-time';
import { BookingsRepository } from '../bookings/bookings.repository';
import { reconcileBookingLifecycle } from '../bookings/booking-lifecycle';
import { ConfiguredRefundGateway } from '../payments/simulated-refund-gateway';
import { RefundsRepository, type PendingRefund } from '../payments/refunds.repository';
import { RefundProcessor } from '../payments/refund-processor';
import type { CreateAmenityInput, ListHotelsQuery, UpdateAmenityInput, UpdateHotelInput } from './admin-hotels.schemas';

/** What an admin needs to know about who owns a hotel (never the password hash or other profile fields). */
const OWNER_SUMMARY = { MaTaiKhoan: true, HoTen: true, Email: true, SoDienThoai: true } as const;

/**
 * Hotel approval state machine (admin side):
 *   Chờ duyệt ── approve ─→ Hoạt động      Hoạt động ── suspend ───→ Đình chỉ
 *   Chờ duyệt ── reject ──→ Từ chối        Đình chỉ ─── reactivate → Hoạt động
 * Every transition is a single guarded UPDATE (`WHERE TrangThai = <expected>`), so two admins acting on the
 * same hotel cannot both succeed and no endpoint can be used to skip a state (e.g. reactivate ≠ approve).
 */
/** What suspending a hotel did to the bookings it had open. */
export interface SuspensionOutcome {
  /** Stays already under way ("Đã xác nhận", check-in time passed) → "Hoàn tất". */
  DonHoanTat: number;
  /** Not yet checked in ("Đã xác nhận" or "Chờ thanh toán") → "Đã hủy". */
  DonDaHuy: number;
  /** Cancelled bookings that had been paid: refunded in full. */
  DonHoanTien: number;
}

const SUSPENSION_NOTE = 'Khách sạn bị quản trị viên đình chỉ';

export class AdminHotelsService {
  constructor(
    private readonly bookings: BookingsRepository = new BookingsRepository(),
    private readonly refunds: RefundsRepository = new RefundsRepository(),
    private readonly refundProcessor: RefundProcessor = new RefundProcessor(new ConfiguredRefundGateway(), refunds)
  ) {}

  async list(q: ListHotelsQuery) {
    const prisma = getPrismaClient();
    const where = {
      ...(q.TrangThai ? { TrangThai: q.TrangThai } : {}),
      ...(q.search ? { TenKhachSan: { contains: q.search } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.kHACH_SAN.findMany({
        where,
        include: {
          DIA_PHUONG: true,
          TAI_KHOAN_KHACH_SAN_MaTaiKhoanSoHuuToTAI_KHOAN: { select: OWNER_SUMMARY },
          // Only the cover (or, failing that, the first photo): the list shows a thumbnail, not the gallery.
          HINH_ANH_KHACH_SAN: { orderBy: [{ AnhDaiDien: 'desc' }, { MaHinhAnh: 'asc' }], take: 1 },
        },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { NgayDangKy: 'desc' },
      }),
      prisma.kHACH_SAN.count({ where }),
    ]);
    return {
      items,
      pagination: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
    };
  }

  async getOne(id: number) {
    const hotel = await getPrismaClient().kHACH_SAN.findUnique({
      where: { MaKhachSan: id },
      include: {
        DIA_PHUONG: true,
        TAI_KHOAN_KHACH_SAN_MaTaiKhoanSoHuuToTAI_KHOAN: { select: OWNER_SUMMARY },
        HINH_ANH_KHACH_SAN: { orderBy: [{ AnhDaiDien: 'desc' }, { MaHinhAnh: 'asc' }] },
        KHACH_SAN_TIEN_NGHI: { include: { TIEN_NGHI: true } },
      },
    });
    if (!hotel) throw AppError.notFound('Không tìm thấy khách sạn');
    return hotel;
  }

  async update(id: number, input: UpdateHotelInput) {
    await this.getOne(id);
    return getPrismaClient().kHACH_SAN.update({ where: { MaKhachSan: id }, data: { ...input, NgayCapNhat: new Date() } });
  }

  /** Chờ duyệt → Hoạt động, recording who approved and when, in one statement. */
  async approve(id: number, adminId: number) {
    const now = new Date();
    return this.transition(id, HOTEL_STATUS.PENDING_APPROVAL, HOTEL_STATUS.ACTIVE, 'Chỉ có thể duyệt khách sạn đang chờ duyệt', {
      MaTaiKhoanDuyet: adminId,
      NgayDuyet: now,
      NgayCapNhat: now,
    });
  }

  /**
   * Chờ duyệt → Từ chối. Deliberately leaves MaTaiKhoanDuyet/NgayDuyet empty: those two columns mean
   * "approved by/at" and are what later tells an owner-side reactivation that the hotel was once approved.
   */
  async reject(id: number) {
    return this.transition(id, HOTEL_STATUS.PENDING_APPROVAL, HOTEL_STATUS.REJECTED, 'Chỉ có thể từ chối khách sạn đang chờ duyệt', {
      NgayCapNhat: new Date(),
    });
  }

  /**
   * Hoạt động → Đình chỉ, and the hotel's open bookings are settled in the same step so nobody is left holding a
   * booking at a hotel that has been shut down:
   *   - a stay already under way ("Đã xác nhận", the hotel's check-in time has passed) → "Hoàn tất";
   *   - a booking not yet checked in ("Đã xác nhận" or still "Chờ thanh toán") → "Đã hủy". Money already paid is
   *     refunded IN FULL (the guest did nothing wrong, so the cancellation policy tiers do not apply).
   * The status change and the booking changes commit together; the refunds are then sent to the gateway with no
   * transaction open, exactly like a customer cancellation, and a failed one stays retryable.
   */
  async suspend(id: number, ipAddr = '127.0.0.1') {
    const hotel = await this.getOne(id);
    if (hotel.TrangThai === HOTEL_STATUS.SUSPENDED) return { ...hotel, DonDaXuLy: { DonHoanTat: 0, DonDaHuy: 0, DonHoanTien: 0 } satisfies SuspensionOutcome };
    if (hotel.TrangThai !== HOTEL_STATUS.ACTIVE) throw AppError.badRequest('Chỉ có thể đình chỉ khách sạn đang hoạt động');

    // Settle stale holds and finished stays first, so only genuinely open bookings are touched below.
    await reconcileBookingLifecycle();

    const now = new Date();
    const pendingRefunds: PendingRefund[] = [];
    const outcome: SuspensionOutcome = { DonHoanTat: 0, DonDaHuy: 0, DonHoanTien: 0 };

    await this.bookings.runInTransaction(async (tx) => {
      const changed = await tx.kHACH_SAN.updateMany({
        where: { MaKhachSan: id, TrangThai: HOTEL_STATUS.ACTIVE },
        data: { TrangThai: HOTEL_STATUS.SUSPENDED, NgayCapNhat: now },
      });
      if (changed.count === 0) throw AppError.conflict('Khách sạn đã đổi trạng thái trước đó — vui lòng tải lại');

      const open = await tx.dAT_PHONG.findMany({
        where: { MaKhachSan: id, TrangThai: { in: [BOOKING_STATUS.PENDING_PAYMENT, BOOKING_STATUS.CONFIRMED] } },
        select: { MaDatPhong: true, TrangThai: true, NgayNhanPhong: true },
      });

      for (const booking of open) {
        const underway = booking.TrangThai === BOOKING_STATUS.CONFIRMED && checkInInstant(booking.NgayNhanPhong, hotel.GioNhanPhong).getTime() <= now.getTime();
        if (underway) {
          if ((await this.bookings.completeBooking(tx, booking.MaDatPhong, `${SUSPENSION_NOTE}: đơn đang lưu trú được chuyển hoàn tất`, now)) === 1) outcome.DonHoanTat += 1;
          continue;
        }

        if ((await this.bookings.cancelBooking(tx, booking.MaDatPhong, `${SUSPENSION_NOTE}: đơn chưa nhận phòng bị hủy`, now)) !== 1) continue;
        outcome.DonDaHuy += 1;

        // Never fabricate a refund for money that was not captured (an unpaid hold, a 0đ booking).
        const payment = await this.refunds.lockSuccessfulPayment(tx, booking.MaDatPhong);
        if (!payment) continue;
        const refund = await this.refunds.openPendingRefund(tx, payment, Number(payment.SoTien), `${SUSPENSION_NOTE} — hoàn 100% tiền đã thanh toán`, now);
        if (refund) {
          pendingRefunds.push(refund);
          outcome.DonHoanTien += 1;
        }
      }
    });

    for (const refund of pendingRefunds) await this.refundProcessor.process(refund, ipAddr);

    return { ...(await this.getOne(id)), DonDaXuLy: outcome };
  }

  async reactivate(id: number) {
    return this.transition(id, HOTEL_STATUS.SUSPENDED, HOTEL_STATUS.ACTIVE, 'Chỉ có thể kích hoạt lại khách sạn đang bị đình chỉ', {
      NgayCapNhat: new Date(),
    });
  }

  private async transition(
    id: number,
    from: string,
    to: string,
    invalidStateMessage: string,
    data: { MaTaiKhoanDuyet?: number; NgayDuyet?: Date; NgayCapNhat: Date }
  ) {
    const prisma = getPrismaClient();
    const changed = await prisma.kHACH_SAN.updateMany({ where: { MaKhachSan: id, TrangThai: from }, data: { ...data, TrangThai: to } });
    if (changed.count === 0) {
      await this.getOne(id); // 404 when the hotel does not exist
      throw AppError.badRequest(invalidStateMessage);
    }
    return this.getOne(id);
  }

  /** The amenity catalogue, with how many hotels and room types use each entry (so the admin sees what a delete would hit). */
  async listAmenities() {
    const rows = await getPrismaClient().tIEN_NGHI.findMany({
      orderBy: { TenTienNghi: 'asc' },
      include: { _count: { select: { KHACH_SAN_TIEN_NGHI: true, LOAI_PHONG_TIEN_NGHI: true } } },
    });
    return rows.map(({ _count, ...amenity }) => ({
      ...amenity,
      SoKhachSan: _count.KHACH_SAN_TIEN_NGHI,
      SoLoaiPhong: _count.LOAI_PHONG_TIEN_NGHI,
    }));
  }

  async createAmenity(input: CreateAmenityInput) {
    await this.assertAmenityNameFree(input.TenTienNghi);
    return this.mapDuplicateName(() =>
      getPrismaClient().tIEN_NGHI.create({ data: { TenTienNghi: input.TenTienNghi, BieuTuong: input.BieuTuong ?? null } })
    );
  }

  async updateAmenity(id: number, input: UpdateAmenityInput) {
    await this.getAmenity(id);
    if (input.TenTienNghi !== undefined) await this.assertAmenityNameFree(input.TenTienNghi, id);
    return this.mapDuplicateName(() => getPrismaClient().tIEN_NGHI.update({ where: { MaTienNghi: id }, data: input }));
  }

  /** Refuses while a hotel or room type still lists the amenity: removing it would silently strip it from live listings. */
  async deleteAmenity(id: number) {
    await this.getAmenity(id);
    const prisma = getPrismaClient();
    const [hotels, roomTypes] = await Promise.all([
      prisma.kHACH_SAN_TIEN_NGHI.count({ where: { MaTienNghi: id } }),
      prisma.lOAI_PHONG_TIEN_NGHI.count({ where: { MaTienNghi: id } }),
    ]);
    if (hotels + roomTypes > 0) {
      throw AppError.conflict(
        `Không thể xóa tiện nghi đang được sử dụng (${hotels} khách sạn, ${roomTypes} loại phòng). Hãy gỡ tiện nghi khỏi các cơ sở trước.`,
        { SoKhachSan: hotels, SoLoaiPhong: roomTypes }
      );
    }
    await prisma.tIEN_NGHI.delete({ where: { MaTienNghi: id } });
  }

  private async getAmenity(id: number) {
    const amenity = await getPrismaClient().tIEN_NGHI.findUnique({ where: { MaTienNghi: id } });
    if (!amenity) throw AppError.notFound('Không tìm thấy tiện nghi');
    return amenity;
  }

  private async assertAmenityNameFree(name: string, exceptId?: number) {
    const clash = await getPrismaClient().tIEN_NGHI.findFirst({
      where: { TenTienNghi: name, ...(exceptId ? { NOT: { MaTienNghi: exceptId } } : {}) },
      select: { MaTienNghi: true },
    });
    if (clash) throw AppError.conflict('Tên tiện nghi đã tồn tại');
  }

  /** The pre-check above can race a concurrent insert; the unique index is the real guard. */
  private async mapDuplicateName<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002') {
        throw AppError.conflict('Tên tiện nghi đã tồn tại');
      }
      throw error;
    }
  }
}
