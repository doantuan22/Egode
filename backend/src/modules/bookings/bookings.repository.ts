import { getPrismaClient } from '../../config/prisma';
import { AppError } from '../../common/errors/app-error';
import { Prisma } from '../../generated/prisma/client';
import { HOTEL_STATUS, ROOM_TYPE_STATUS, ROOM_RATE_STATUS, BOOKING_STATUS } from '../../common/constants/hotel-status';
import { CANCELLATION_POLICY_STATUS } from '../../common/constants/commercial';
import { PAYMENT_STATUS } from '../../common/constants/payment';

export interface LockedRateRow {
  MaLoaiPhong: number;
  NgayApDung: Date;
  GiaPhong: number;
  SoLuongPhong: number;
}

export interface BookedRow {
  MaLoaiPhong: number;
  SoLuongPhong: number;
  NgayNhanPhong: Date;
  NgayTraPhong: Date;
}

/** A KHUYEN_MAI row read under usp_KhoaKhuyenMaiChoDatPhong's lock, plus its non-cancelled usage count at that moment. */
export interface LockedPromotion {
  MaKhuyenMai: number;
  MaCode: string;
  LoaiGiamGia: string;
  GiaTriGiam: number;
  GiaTriDonToiThieu: number;
  MucGiamToiDa: number;
  SoLuongGioiHan: number;
  NgayBatDau: Date;
  NgayKetThuc: Date;
  TrangThai: string;
  DaDung: number;
}

/** THROW numbers raised by usp_KhoaKhuyenMaiChoDatPhong (database/migrations/008_promotion_booking_lock.sql). */
const PROMOTION_SQL_ERROR = { NOT_FOUND: 50011, EXHAUSTED: 50012 } as const;

/** The SQL Server error number behind a failed raw query, or null if it is not one. */
const sqlErrorNumber = (err: unknown): number | null => {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2010') return null;
  const cause = (err.meta as { driverAdapterError?: { cause?: { code?: unknown } } } | undefined)?.driverAdapterError?.cause;
  return typeof cause?.code === 'number' ? cause.code : null;
};

export interface InsertBookingData {
  maXacNhanDatPhong: string;
  maTaiKhoanKhachHang: number;
  maKhachSan: number;
  maKhuyenMai: number | null;
  maChinhSachHuy: number;
  ngayNhanPhong: Date;
  ngayTraPhong: Date;
  tongTienPhong: number;
  soTienGiam: number;
  tongTienThanhToan: number;
  ghiChu: string | null;
  /** Initial DAT_PHONG.TrangThai: "Chờ thanh toán" unless nothing is payable (see BookingsService.createBooking). */
  trangThai: string;
}

export class BookingsRepository {
  async findActiveHotel(maKhachSan: number) {
    const prisma = getPrismaClient();
    return prisma.kHACH_SAN.findFirst({ where: { MaKhachSan: maKhachSan, TrangThai: HOTEL_STATUS.ACTIVE } });
  }

  async findActiveRoomTypesByIds(maKhachSan: number, ids: number[]) {
    const prisma = getPrismaClient();
    return prisma.lOAI_PHONG.findMany({
      where: { MaKhachSan: maKhachSan, MaLoaiPhong: { in: ids }, TrangThai: ROOM_TYPE_STATUS.ACTIVE },
      select: { MaLoaiPhong: true, TenLoaiPhong: true },
    });
  }

  async runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const prisma = getPrismaClient();
    return prisma.$transaction(fn);
  }

  /**
   * Gates concurrent bookings for the same room type(s)/date range. Locks
   * every matching QUY_PHONG_GIA row with WITH (UPDLOCK, ROWLOCK, HOLDLOCK):
   * a second transaction requesting an overlapping room type + date range
   * blocks on this SELECT until this transaction commits or rolls back, then
   * re-reads the now-committed booked count. U-locks (unlike shared locks)
   * are mutually exclusive, so this serializes competing bookings at the
   * read step instead of racing on the later INSERT (see M5 report §2).
   */
  async lockRatesForUpdate(
    tx: Prisma.TransactionClient,
    maLoaiPhongIds: number[],
    checkIn: Date,
    checkOut: Date
  ): Promise<LockedRateRow[]> {
    return tx.$queryRaw<LockedRateRow[]>(Prisma.sql`
      SELECT MaLoaiPhong, NgayApDung, GiaPhong, SoLuongPhong
      FROM QUY_PHONG_GIA WITH (UPDLOCK, ROWLOCK, HOLDLOCK)
      WHERE MaLoaiPhong IN (${Prisma.join(maLoaiPhongIds)})
        AND TrangThai = ${ROOM_RATE_STATUS.OPEN_FOR_SALE}
        AND NgayApDung >= ${checkIn} AND NgayApDung < ${checkOut}
      ORDER BY MaLoaiPhong, NgayApDung
    `);
  }

  /** Rooms already occupied by non-cancelled bookings overlapping the stay — read after the gating lock above is held. */
  async findBookedQuantities(
    tx: Prisma.TransactionClient,
    maLoaiPhongIds: number[],
    checkIn: Date,
    checkOut: Date
  ): Promise<BookedRow[]> {
    const rows = await tx.cHI_TIET_DAT_PHONG.findMany({
      where: {
        MaLoaiPhong: { in: maLoaiPhongIds },
        DAT_PHONG: {
          TrangThai: { not: BOOKING_STATUS.CANCELLED },
          NgayNhanPhong: { lt: checkOut },
          NgayTraPhong: { gt: checkIn },
        },
      },
      select: {
        MaLoaiPhong: true,
        SoLuongPhong: true,
        DAT_PHONG: { select: { NgayNhanPhong: true, NgayTraPhong: true } },
      },
    });
    return rows.map((r) => ({
      MaLoaiPhong: r.MaLoaiPhong,
      SoLuongPhong: r.SoLuongPhong,
      NgayNhanPhong: r.DAT_PHONG.NgayNhanPhong,
      NgayTraPhong: r.DAT_PHONG.NgayTraPhong,
    }));
  }

  /**
   * First step of a booking that uses a promo code (BUG-001). Calls
   * usp_KhoaKhuyenMaiChoDatPhong, which — inside THIS transaction — locks the
   * promo's KHUYEN_MAI row (UPDLOCK, HOLDLOCK, ROWLOCK), and only then reads it
   * and counts its non-cancelled bookings. The lock is held until the booking
   * transaction ends, so concurrent bookings of the same promo queue here and
   * each sees every earlier one. Must run BEFORE lockRatesForUpdate (lock order:
   * KHUYEN_MAI -> QUY_PHONG_GIA -> INSERT). The procedure THROWs when the promo
   * does not exist or its SoLuongGioiHan is already used up.
   */
  async lockPromotionForBooking(tx: Prisma.TransactionClient, maCode: string): Promise<LockedPromotion> {
    try {
      const rows = await tx.$queryRaw<LockedPromotion[]>`EXEC dbo.usp_KhoaKhuyenMaiChoDatPhong ${maCode}`;
      return rows[0];
    } catch (err) {
      switch (sqlErrorNumber(err)) {
        case PROMOTION_SQL_ERROR.NOT_FOUND:
          throw AppError.badRequest('Mã khuyến mãi không tồn tại');
        case PROMOTION_SQL_ERROR.EXHAUSTED:
          throw AppError.badRequest('Mã khuyến mãi đã hết lượt sử dụng');
        default:
          throw err;
      }
    }
  }

  /** Same resolution rule as M4 (oldest still-active policy) — re-read fresh inside the transaction, never trusted from a prior quote. */
  async findActiveCancellationPolicy(tx: Prisma.TransactionClient) {
    return tx.cHINH_SACH_HUY.findFirst({
      where: { TrangThai: CANCELLATION_POLICY_STATUS.ACTIVE },
      include: { CHI_TIET_CHINH_SACH_HUY: { orderBy: { SoGioTruocNhanPhong: 'desc' } } },
      orderBy: { MaChinhSachHuy: 'asc' },
    });
  }

  async insertBooking(tx: Prisma.TransactionClient, data: InsertBookingData) {
    const now = new Date();
    return tx.dAT_PHONG.create({
      data: {
        MaXacNhanDatPhong: data.maXacNhanDatPhong,
        TAI_KHOAN: { connect: { MaTaiKhoan: data.maTaiKhoanKhachHang } },
        KHACH_SAN: { connect: { MaKhachSan: data.maKhachSan } },
        ...(data.maKhuyenMai ? { KHUYEN_MAI: { connect: { MaKhuyenMai: data.maKhuyenMai } } } : {}),
        CHINH_SACH_HUY: { connect: { MaChinhSachHuy: data.maChinhSachHuy } },
        NgayNhanPhong: data.ngayNhanPhong,
        NgayTraPhong: data.ngayTraPhong,
        TongTienPhong: data.tongTienPhong,
        SoTienGiam: data.soTienGiam,
        TongTienThanhToan: data.tongTienThanhToan,
        GhiChu: data.ghiChu,
        TrangThai: data.trangThai,
        NgayTao: now,
        NgayCapNhat: now,
      },
    });
  }

  async insertBookingLines(
    tx: Prisma.TransactionClient,
    maDatPhong: number,
    lines: Array<{ maLoaiPhong: number; soLuong: number }>
  ): Promise<void> {
    await tx.cHI_TIET_DAT_PHONG.createMany({
      data: lines.map((l) => ({ MaDatPhong: maDatPhong, MaLoaiPhong: l.maLoaiPhong, SoLuongPhong: l.soLuong })),
    });
  }

  /** Newest first — a personal booking history list, no pagination (M6 §5, out of report/analytics scope). */
  async listByCustomer(maTaiKhoanKhachHang: number) {
    const prisma = getPrismaClient();
    return prisma.dAT_PHONG.findMany({
      where: { MaTaiKhoanKhachHang: maTaiKhoanKhachHang },
      include: {
        KHACH_SAN: {
          select: {
            TenKhachSan: true,
            DiaChiChiTiet: true,
            // A history row needs only the cover image. Do not include the
            // full gallery for every booking in the list response.
            HINH_ANH_KHACH_SAN: {
              where: { AnhDaiDien: true },
              select: { URL: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { NgayTao: 'desc' },
    });
  }

  /** Fetched by id only (no owner filter) — the caller distinguishes 404 (no such booking) from 403 (not the owner), same convention as owner/hotels. */
  async findDetailById(maDatPhong: number) {
    const prisma = getPrismaClient();
    return prisma.dAT_PHONG.findUnique({
      where: { MaDatPhong: maDatPhong },
      include: {
        KHACH_SAN: {
          select: {
            TenKhachSan: true,
            DiaChiChiTiet: true,
            GioNhanPhong: true,
            HINH_ANH_KHACH_SAN: {
              where: { AnhDaiDien: true },
              select: { URL: true },
              take: 1,
            },
          },
        },
        CHI_TIET_DAT_PHONG: { include: { LOAI_PHONG: { select: { TenLoaiPhong: true } } } },
        CHINH_SACH_HUY: { include: { CHI_TIET_CHINH_SACH_HUY: { orderBy: { SoGioTruocNhanPhong: 'desc' } } } },
        KHUYEN_MAI: true,
        THANH_TOAN: { orderBy: { ThoiGianGiaoDich: 'desc' }, include: { HOAN_TIEN: { orderBy: { NgayYeuCau: 'desc' } } } },
      },
    });
  }

  /** Guarded transition — only succeeds if the booking is still in a cancellable state; races (double-cancel, expiry) resolve to 0 rows affected instead of corrupting state. */
  async cancelBooking(tx: Prisma.TransactionClient, maDatPhong: number, note: string, now: Date): Promise<number> {
    const result = await tx.$executeRaw(Prisma.sql`
      UPDATE DAT_PHONG
      SET TrangThai = ${BOOKING_STATUS.CANCELLED},
          NgayCapNhat = ${now},
          GhiChu = CASE WHEN GhiChu IS NULL THEN ${note} ELSE GhiChu + N' | ' + ${note} END
      WHERE MaDatPhong = ${maDatPhong}
        AND TrangThai IN (${BOOKING_STATUS.PENDING_PAYMENT}, ${BOOKING_STATUS.CONFIRMED})
    `);
    return Number(result);
  }

  /** The single successful payment for a booking (by design there is at most one — see payments.service.ts). */
  async findSuccessfulPayment(tx: Prisma.TransactionClient, maDatPhong: number) {
    return tx.tHANH_TOAN.findFirst({
      where: { MaDatPhong: maDatPhong, TrangThai: PAYMENT_STATUS.SUCCESS },
    });
  }

  async insertRefund(
    tx: Prisma.TransactionClient,
    data: { maThanhToan: number; soTienHoan: number; lyDoHoanTien: string; maGiaoDichDoiTac: string; trangThai: string; ngayYeuCau: Date }
  ) {
    return tx.hOAN_TIEN.create({
      data: {
        MaThanhToan: data.maThanhToan,
        SoTienHoan: data.soTienHoan,
        LyDoHoanTien: data.lyDoHoanTien,
        MaGiaoDichDoiTac: data.maGiaoDichDoiTac,
        TrangThai: data.trangThai,
        NgayYeuCau: data.ngayYeuCau,
      },
    });
  }

  async markRefundOutcome(tx: Prisma.TransactionClient, maHoanTien: number, trangThai: string, ngayHoanTien: Date | null) {
    return tx.hOAN_TIEN.update({ where: { MaHoanTien: maHoanTien }, data: { TrangThai: trangThai, NgayHoanTien: ngayHoanTien } });
  }
}
