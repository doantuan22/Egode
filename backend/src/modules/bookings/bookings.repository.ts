import { getPrismaClient } from '../../config/prisma';
import { AppError } from '../../common/errors/app-error';
import { Prisma } from '../../generated/prisma/client';
import { HOTEL_STATUS, ROOM_TYPE_STATUS, ROOM_RATE_STATUS, BOOKING_STATUS } from '../../common/constants/hotel-status';
import { CANCELLATION_POLICY_STATUS } from '../../common/constants/commercial';

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

/** Khuyến mãi đọc dưới khóa kèm số lượt dùng */
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

/** Mã lỗi THROW của thủ tục khóa khuyến mãi */
const PROMOTION_SQL_ERROR = { NOT_FOUND: 50011, EXHAUSTED: 50012 } as const;

/** Mã lỗi SQL Server của truy vấn thất bại */
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
  /** Trạng thái ban đầu của đơn đặt phòng */
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
      select: { MaLoaiPhong: true, TenLoaiPhong: true, SucChua: true },
    });
  }

  /** Sức chứa đọc trong giao dịch đặt phòng */
  async findCapacities(tx: Prisma.TransactionClient, maKhachSan: number, ids: number[]) {
    return tx.lOAI_PHONG.findMany({
      where: { MaKhachSan: maKhachSan, MaLoaiPhong: { in: ids } },
      select: { MaLoaiPhong: true, SucChua: true },
    });
  }

  async runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const prisma = getPrismaClient();
    return prisma.$transaction(fn);
  }

  /** Khóa các dòng quỹ phòng để tuần tự hóa đặt phòng đồng thời */
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

  /** Số phòng đã bị các đơn chưa hủy chiếm trong kỳ lưu trú */
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

  /** Khóa khuyến mãi trước khi khóa quỹ phòng */
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

  /** Chính sách hủy hiện hành đọc lại trong giao dịch */
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

  /** Lịch sử đặt phòng mới nhất trước, không phân trang */
  async listByCustomer(maTaiKhoanKhachHang: number) {
    const prisma = getPrismaClient();
    return prisma.dAT_PHONG.findMany({
      where: { MaTaiKhoanKhachHang: maTaiKhoanKhachHang },
      include: {
        KHACH_SAN: {
          select: {
            TenKhachSan: true,
            DiaChiChiTiet: true,
            // Chỉ lấy ảnh bìa
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

  /** Lấy theo mã đơn, service phân biệt 404 và 403 */
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
            GioTraPhong: true,
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

  /** Chuyển Đã xác nhận sang Hoàn tất kèm ghi chú */
  async completeBooking(tx: Prisma.TransactionClient, maDatPhong: number, note: string, now: Date): Promise<number> {
    const result = await tx.$executeRaw(Prisma.sql`
      UPDATE DAT_PHONG
      SET TrangThai = ${BOOKING_STATUS.COMPLETED},
          NgayCapNhat = ${now},
          GhiChu = CASE WHEN GhiChu IS NULL THEN ${note} ELSE GhiChu + N' | ' + ${note} END
      WHERE MaDatPhong = ${maDatPhong}
        AND TrangThai = ${BOOKING_STATUS.CONFIRMED}
    `);
    return Number(result);
  }

  /** Chuyển trạng thái hủy có điều kiện để tránh tranh chấp */
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
}
