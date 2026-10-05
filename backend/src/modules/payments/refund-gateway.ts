/**
 * Abstraction over "actually tell the payment gateway to send money back".
 * PaymentsService depends on the interface, not on VnpayRefundGateway
 * directly (DI via constructor default, same pattern as
 * BookingsService/BookingsRepository) — tests inject a FakeRefundGateway so
 * refund idempotency/cap logic can be verified without a live network call
 * to VNPAY sandbox (see payments.test.ts).
 */
import { createHmac } from 'node:crypto';
import { env } from '../../config/env';
import { toVnpayDate } from './vnpay';

export interface RefundRequestInput {
  /** Our own refund request id (HOAN_TIEN.MaGiaoDichDoiTac) — VNPAY's vnp_TxnRef for the refund call. */
  refundRef: string;
  /** The ORIGINAL payment's vnp_TxnRef. */
  originalTxnRef: string;
  /** VNPAY's vnp_TransactionNo from the original successful payment callback. */
  originalTransactionNo: string;
  /** VNPAY's vnp_PayDate from the original successful payment callback (yyyyMMddHHmmss). */
  originalPayDate: string;
  /** VND — the amount to refund (already capped to <= amount paid by PaymentsService). */
  amount: number;
  reason: string;
  ipAddr: string;
}

export interface RefundResult {
  success: boolean;
  message: string;
}

export interface RefundGateway {
  requestRefund(input: RefundRequestInput): Promise<RefundResult>;
  /** false for a gateway that does not need the original VNPAY transaction number (the simulated one). Default: true. */
  requiresOriginalTransaction?(): boolean;
}

/**
 * Real VNPAY sandbox refund call (`vnp_Command=refund`, their merchant
 * webapi — documented publicly, distinct endpoint/signing scheme from the
 * hosted-page payment flow in vnpay.ts: pipe-joined fields, not sorted
 * query params). Requires a real VNPAY_TMN_CODE/VNPAY_HASH_SECRET —  with
 * the `dev`/`dev` placeholders this project ships with, VNPAY will reject
 * the signature and this correctly resolves to `success: false` (HOAN_TIEN
 * ends up "Thất bại", never faked as "Thành công" — see M6 report §4).
 */
export class VnpayRefundGateway implements RefundGateway {
  async requestRefund(input: RefundRequestInput): Promise<RefundResult> {
    const now = new Date();
    const vnp_RequestId = input.refundRef;
    const vnp_Version = '2.1.0';
    const vnp_Command = 'refund';
    const vnp_TmnCode = env.VNPAY_TMN_CODE;
    const vnp_TransactionType = '02'; // 02 = full/partial refund of a successful transaction
    const vnp_TxnRef = input.originalTxnRef;
    const vnp_Amount = Math.round(input.amount * 100);
    const vnp_TransactionNo = input.originalTransactionNo;
    const vnp_TransactionDate = input.originalPayDate;
    const vnp_CreateBy = 'system';
    const vnp_CreateDate = toVnpayDate(now);
    const vnp_IpAddr = input.ipAddr;
    const vnp_OrderInfo = input.reason;

    const signData = [
      vnp_RequestId,
      vnp_Version,
      vnp_Command,
      vnp_TmnCode,
      vnp_TransactionType,
      vnp_TxnRef,
      vnp_Amount,
      vnp_TransactionNo,
      vnp_TransactionDate,
      vnp_CreateBy,
      vnp_CreateDate,
      vnp_IpAddr,
      vnp_OrderInfo,
    ].join('|');
    const vnp_SecureHash = createHmac('sha512', env.VNPAY_HASH_SECRET).update(signData).digest('hex');

    const body = {
      vnp_RequestId,
      vnp_Version,
      vnp_Command,
      vnp_TmnCode,
      vnp_TransactionType,
      vnp_TxnRef,
      vnp_Amount,
      vnp_TransactionNo,
      vnp_CreateBy,
      vnp_OrderInfo,
      vnp_TransactionDate,
      vnp_CreateDate,
      vnp_IpAddr,
      vnp_SecureHash,
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(env.VNPAY_REFUND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      const json = (await res.json().catch(() => null)) as { vnp_ResponseCode?: string; vnp_Message?: string } | null;
      if (json?.vnp_ResponseCode === '00') {
        return { success: true, message: json.vnp_Message ?? 'Refund confirmed by VNPAY' };
      }
      // VNPAY answered with a response code other than 00: a definitive rejection.
      if (json?.vnp_ResponseCode) {
        return { success: false, message: json.vnp_Message ?? `VNPAY refund rejected (code ${json.vnp_ResponseCode})` };
      }
      return { success: false, message: `VNPAY refund gave no readable answer (HTTP ${res.status})` };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'VNPAY refund request failed' };
    }
  }
}
