import { getPrismaClient } from '../../config/prisma';
import { Prisma } from '../../generated/prisma/client';
import { PAYMENT_STATUS, REFUND_STATUS } from '../../common/constants/payment';
import { generateRefundRef } from './vnpay';

/**
 * Persistence for the HOAN_TIEN lifecycle, shared by the cancel, late-payment and retry flows.
 *
 * Rule that shapes every method here: nothing in this file talks to the payment gateway, and the gateway
 * is never called while one of these transactions is open. A refund is (1) recorded as "Chờ xử lý" in a
 * short transaction that commits, (2) sent to the gateway with no transaction open, (3) settled by one
 * guarded single-statement UPDATE (see RefundProcessor).
 */

/** What the gateway step needs; everything else is read from the committed HOAN_TIEN row. */
export interface PendingRefund {
  maHoanTien: number;
  /** The ORIGINAL payment's MaGiaoDichDoiTac (txnRef:transactionNo:payDate). */
  packedOriginalRef: string;
  /** HOAN_TIEN.MaGiaoDichDoiTac — our own refund id, reused unchanged on every retry. */
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

  /** Exclusive lock on one refund row until the transaction ends, then the row with its payment/booking. */
  async lockRefund(tx: Prisma.TransactionClient, maHoanTien: number) {
    await tx.$queryRaw<Array<{ MaHoanTien: number }>>(Prisma.sql`
      SELECT MaHoanTien FROM HOAN_TIEN WITH (UPDLOCK, HOLDLOCK, ROWLOCK) WHERE MaHoanTien = ${maHoanTien}
    `);
    return tx.hOAN_TIEN.findUnique({ where: { MaHoanTien: maHoanTien }, include: refundWithOwnership });
  }

  async findRefund(maHoanTien: number) {
    return getPrismaClient().hOAN_TIEN.findUnique({ where: { MaHoanTien: maHoanTien }, include: refundWithOwnership });
  }

  /** The booking's single successful payment, locked so cancel/callback/retry cannot interleave on it. */
  async lockSuccessfulPayment(tx: Prisma.TransactionClient, maDatPhong: number) {
    await tx.$queryRaw<Array<{ MaThanhToan: number }>>(Prisma.sql`
      SELECT MaThanhToan FROM THANH_TOAN WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
      WHERE MaDatPhong = ${maDatPhong} AND TrangThai = ${PAYMENT_STATUS.SUCCESS}
    `);
    return tx.tHANH_TOAN.findFirst({ where: { MaDatPhong: maDatPhong, TrangThai: PAYMENT_STATUS.SUCCESS } });
  }

  /**
   * Money already earmarked for refund on a payment: every HOAN_TIEN row counts, whatever its status, because a
   * failed refund is retried on the same row (and so still owns its amount). Optionally leaves one row out.
   */
  async sumReservedRefunds(tx: Prisma.TransactionClient, maThanhToan: number, exceptMaHoanTien?: number): Promise<number> {
    const rows = await tx.hOAN_TIEN.findMany({
      where: { MaThanhToan: maThanhToan, ...(exceptMaHoanTien !== undefined ? { MaHoanTien: { not: exceptMaHoanTien } } : {}) },
      select: { SoTienHoan: true },
    });
    return rows.reduce((sum, row) => sum + Number(row.SoTienHoan), 0);
  }

  /**
   * Records the refund for a payment as "Chờ xử lý" (NgayHoanTien NULL) inside the caller's transaction, capped so
   * the refunds of one payment can never add up to more than it paid. Returns null when nothing may be refunded.
   * The caller must hold the payment lock and call RefundProcessor.process AFTER its transaction commits.
   */
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

  /**
   * Takes a FAILED refund over for another attempt: same row, same amount, same MaGiaoDichDoiTac, back to
   * "Chờ xử lý". Only TrangThai changes — NgayYeuCau is when the refund was first requested and is written once,
   * at creation; NgayHoanTien is written only by settle() when the refund succeeds. The status itself is the
   * claim: a concurrent retry that finds "Chờ xử lý" knows an attempt is under way. Guarded on the status the
   * caller just read under the row lock.
   */
  async claimForRetry(tx: Prisma.TransactionClient, maHoanTien: number): Promise<boolean> {
    const result = await tx.hOAN_TIEN.updateMany({
      where: { MaHoanTien: maHoanTien, TrangThai: REFUND_STATUS.FAILED },
      data: { TrangThai: REFUND_STATUS.PENDING },
    });
    return result.count === 1;
  }

  /** Settles a pending refund with ONE guarded statement (its own short transaction); false if it was no longer pending. */
  async settle(maHoanTien: number, trangThai: string, ngayHoanTien: Date | null): Promise<boolean> {
    const result = await getPrismaClient().hOAN_TIEN.updateMany({
      where: { MaHoanTien: maHoanTien, TrangThai: REFUND_STATUS.PENDING },
      data: { TrangThai: trangThai, NgayHoanTien: ngayHoanTien },
    });
    return result.count === 1;
  }
}
