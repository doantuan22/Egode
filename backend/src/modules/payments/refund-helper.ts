/**
 * Shared by bookings.service (cancel → refund) and payments.service (a
 * late payment-success callback arriving after the booking already expired
 * — see payments.service.ts `handleCallback`) so both go through the exact
 * same "never fake success" gateway call.
 */
import type { RefundGateway, RefundResult } from './refund-gateway';
import { decodeGatewayRef } from './vnpay';

export const attemptGatewayRefund = async (
  gateway: RefundGateway,
  packedOriginalRef: string,
  refundRef: string,
  amount: number,
  ipAddr: string
): Promise<RefundResult> => {
  const { txnRef, transactionNo, payDate } = decodeGatewayRef(packedOriginalRef);
  const needsTransaction = gateway.requiresOriginalTransaction?.() ?? true;
  if (needsTransaction && (!transactionNo || !payDate)) {
    return { success: false, message: 'Thiếu thông tin giao dịch gốc từ VNPAY (chưa có vnp_TransactionNo)' };
  }
  try {
    return await gateway.requestRefund({
      refundRef,
      originalTxnRef: txnRef,
      originalTransactionNo: transactionNo ?? '',
      originalPayDate: payDate ?? '',
      amount,
      reason: 'Hoan tien huy dat phong',
      ipAddr,
    });
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Refund gateway error' };
  }
};
