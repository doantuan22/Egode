import { getPrismaClient } from '../../config/prisma';
import { Prisma, type THANH_TOAN } from '../../generated/prisma/client';
import { BOOKING_STATUS } from '../../common/constants/hotel-status';
import { PAYMENT_STATUS } from '../../common/constants/payment';

export interface InsertPaymentData {
  maDatPhong: number;
  soTien: number;
  phuongThucThanhToan: string;
  maGiaoDichDoiTac: string;
  trangThai: string;
  thoiGianGiaoDich: Date;
}

export class PaymentsRepository {
  async findBookingById(maDatPhong: number) {
    const prisma = getPrismaClient();
    return prisma.dAT_PHONG.findUnique({ where: { MaDatPhong: maDatPhong } });
  }

  async insertPayment(data: InsertPaymentData) {
    const prisma = getPrismaClient();
    return prisma.tHANH_TOAN.create({
      data: {
        MaDatPhong: data.maDatPhong,
        SoTien: data.soTien,
        PhuongThucThanhToan: data.phuongThucThanhToan,
        MaGiaoDichDoiTac: data.maGiaoDichDoiTac,
        TrangThai: data.trangThai,
        ThoiGianGiaoDich: data.thoiGianGiaoDich,
      },
    });
  }

  /** Khóa dòng đơn đặt phòng để các yêu cầu thanh toán xếp hàng */
  async lockBookingById(tx: Prisma.TransactionClient, maDatPhong: number) {
    await tx.$queryRaw<Array<{ MaDatPhong: number }>>(Prisma.sql`
      SELECT MaDatPhong
      FROM DAT_PHONG WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
      WHERE MaDatPhong = ${maDatPhong}
    `);
    return tx.dAT_PHONG.findUnique({ where: { MaDatPhong: maDatPhong } });
  }

  async findSuccessfulPaymentTx(tx: Prisma.TransactionClient, maDatPhong: number) {
    return tx.tHANH_TOAN.findFirst({ where: { MaDatPhong: maDatPhong, TrangThai: PAYMENT_STATUS.SUCCESS } });
  }

  /** Lần thanh toán đang mở của đơn */
  async findPendingPaymentTx(tx: Prisma.TransactionClient, maDatPhong: number) {
    return tx.tHANH_TOAN.findFirst({
      where: { MaDatPhong: maDatPhong, TrangThai: PAYMENT_STATUS.PENDING },
      orderBy: { MaThanhToan: 'asc' },
    });
  }

  async insertPaymentTx(tx: Prisma.TransactionClient, data: InsertPaymentData) {
    return tx.tHANH_TOAN.create({
      data: {
        MaDatPhong: data.maDatPhong,
        SoTien: data.soTien,
        PhuongThucThanhToan: data.phuongThucThanhToan,
        MaGiaoDichDoiTac: data.maGiaoDichDoiTac,
        TrangThai: data.trangThai,
        ThoiGianGiaoDich: data.thoiGianGiaoDich,
      },
    });
  }

  async findExistingSuccessfulPayment(maDatPhong: number) {
    const prisma = getPrismaClient();
    return prisma.tHANH_TOAN.findFirst({ where: { MaDatPhong: maDatPhong, TrangThai: PAYMENT_STATUS.SUCCESS } });
  }

  /** Tìm theo tiền tố mã giao dịch vì mã được ghi lại sau khi VNPAY xác nhận */
  async findPaymentByTxnRef(tx: Prisma.TransactionClient, txnRef: string) {
    const rows = await tx.$queryRaw<THANH_TOAN[]>(Prisma.sql`
      SELECT TOP 1 *
      FROM THANH_TOAN WITH (UPDLOCK, ROWLOCK, HOLDLOCK)
      WHERE MaGiaoDichDoiTac = ${txnRef}
         OR MaGiaoDichDoiTac LIKE ${`${txnRef}:%`}
      ORDER BY MaThanhToan
    `);
    return rows[0] ?? null;
  }

  async markPaymentOutcome(tx: Prisma.TransactionClient, maThanhToan: number, trangThai: string, maGiaoDichDoiTac?: string) {
    return tx.tHANH_TOAN.update({
      where: { MaThanhToan: maThanhToan },
      data: { TrangThai: trangThai, ...(maGiaoDichDoiTac ? { MaGiaoDichDoiTac: maGiaoDichDoiTac } : {}) },
    });
  }

  /** Xác nhận đơn có điều kiện, an toàn khi gọi lặp */
  async confirmBookingIfPending(tx: Prisma.TransactionClient, maDatPhong: number, now: Date): Promise<number> {
    const res = await tx.dAT_PHONG.updateMany({
      where: { MaDatPhong: maDatPhong, TrangThai: BOOKING_STATUS.PENDING_PAYMENT },
      data: { TrangThai: BOOKING_STATUS.CONFIRMED, NgayCapNhat: now },
    });
    return res.count;
  }

  async findPaymentsWithRefundsForBooking(maDatPhong: number) {
    const prisma = getPrismaClient();
    return prisma.tHANH_TOAN.findMany({
      where: { MaDatPhong: maDatPhong },
      orderBy: { ThoiGianGiaoDich: 'desc' },
      include: { HOAN_TIEN: { orderBy: { NgayYeuCau: 'desc' } } },
    });
  }
  async runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const prisma = getPrismaClient();
    return prisma.$transaction(fn);
  }
}
