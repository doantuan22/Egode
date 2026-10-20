import { getPrismaClient } from '../../config/prisma';
import { Prisma } from '../../generated/prisma/client';
import { PAYMENT_STATUS, REFUND_STATUS } from '../../common/constants/payment';
import { generateRefundRef } from './vnpay';

/** Lưu trữ vòng đời hoàn tiền, không gọi cổng thanh toán */

/** Dữ liệu bước gọi cổng cần */
export interface PendingRefund {
  maHoanTien: number;
  /** Mã giao dịch gốc dạng txnRef:transactionNo:payDate */
  packedOriginalRef: string;
  /** Mã hoàn tiền của hệ thống, giữ nguyên khi thử lại */
  refundRef: string;
  amount: number;
}

export interface RefundablePayment {
  MaThanhToan: number;
  SoTien: unknown;
  MaGiaoDichDoiTac: string;
}

const refundWithOwnership = { THANH_TOAN: { include: { DAT_PHONG: true } } } as const;

export class RefundsRepository {
  async runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return getPrismaClient().$transaction(fn);
  }

  /** Khóa một dòng hoàn tiền đến hết giao dịch rồi đọc kèm thanh toán và đơn */
  async lockRefund(tx: Prisma.TransactionClient, maHoanTien: number) {
    await tx.$queryRaw<Array<{ MaHoanTien: number }>>(Prisma.sql`
      SELECT MaHoanTien FROM HOAN_TIEN WITH (UPDLOCK, HOLDLOCK, ROWLOCK) WHERE MaHoanTien = ${maHoanTien}
    `);
    return tx.hOAN_TIEN.findUnique({ where: { MaHoanTien: maHoanTien }, include: refundWithOwnership });
  }

  async findRefund(maHoanTien: number) {
    return getPrismaClient().hOAN_TIEN.findUnique({ where: { MaHoanTien: maHoanTien }, include: refundWithOwnership });
  }

  /** Thanh toán thành công duy nhất của đơn, được khóa */
  async lockSuccessfulPayment(tx: Prisma.TransactionClient, maDatPhong: number) {
    await tx.$queryRaw<Array<{ MaThanhToan: number }>>(Prisma.sql`
      SELECT MaThanhToan FROM THANH_TOAN WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
      WHERE MaDatPhong = ${maDatPhong} AND TrangThai = ${PAYMENT_STATUS.SUCCESS}
    `);
    return tx.tHANH_TOAN.findFirst({ where: { MaDatPhong: maDatPhong, TrangThai: PAYMENT_STATUS.SUCCESS } });
  }

  /** Tổng tiền đã giữ để hoàn trên một thanh toán */
  async sumReservedRefunds(tx: Prisma.TransactionClient, maThanhToan: number, exceptMaHoanTien?: number): Promise<number> {
    const rows = await tx.hOAN_TIEN.findMany({
      where: { MaThanhToan: maThanhToan, ...(exceptMaHoanTien !== undefined ? { MaHoanTien: { not: exceptMaHoanTien } } : {}) },
      select: { SoTienHoan: true },
    });
    return rows.reduce((sum, row) => sum + Number(row.SoTienHoan), 0);
  }

  /** Ghi yêu cầu hoàn tiền ở trạng thái chờ, không vượt số đã thanh toán */
  async openPendingRefund(
    tx: Prisma.TransactionClient,
    payment: RefundablePayment,
    requestedAmount: number,
    reason: string,
    now: Date,
    packedOriginalRef: string = payment.MaGiaoDichDoiTac
  ): Promise<PendingRefund | null> {
    const available = Number(payment.SoTien) - (await this.sumReservedRefunds(tx, payment.MaThanhToan));
    const amount = Math.min(requestedAmount, available);
    if (amount <= 0) return null;

    const refundRef = generateRefundRef();
    const refund = await tx.hOAN_TIEN.create({
      data: {
        MaThanhToan: payment.MaThanhToan,
        SoTienHoan: amount,
        LyDoHoanTien: reason,
        MaGiaoDichDoiTac: refundRef,
        TrangThai: REFUND_STATUS.PENDING,
        NgayYeuCau: now,
        NgayHoanTien: null,
      },
    });
    return { maHoanTien: refund.MaHoanTien, packedOriginalRef, refundRef, amount };
  }

  /** Nhận lại hoàn tiền thất bại để thử lần nữa trên cùng một dòng */
  async claimForRetry(tx: Prisma.TransactionClient, maHoanTien: number): Promise<boolean> {
    const result = await tx.hOAN_TIEN.updateMany({
      where: { MaHoanTien: maHoanTien, TrangThai: REFUND_STATUS.FAILED },
      data: { TrangThai: REFUND_STATUS.PENDING },
    });
    return result.count === 1;
  }

  /** Chốt hoàn tiền đang chờ bằng một câu lệnh có điều kiện */
  async settle(maHoanTien: number, trangThai: string, ngayHoanTien: Date | null): Promise<boolean> {
    const result = await getPrismaClient().hOAN_TIEN.updateMany({
      where: { MaHoanTien: maHoanTien, TrangThai: REFUND_STATUS.PENDING },
      data: { TrangThai: trangThai, NgayHoanTien: ngayHoanTien },
    });
    return result.count === 1;
  }
}
