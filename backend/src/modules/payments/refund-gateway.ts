/** Giao diện gọi cổng thanh toán để hoàn tiền */
import { createHmac } from 'node:crypto';
import { env } from '../../config/env';
import { toVnpayDate } from './vnpay';

export interface RefundRequestInput {
  /** Mã yêu cầu hoàn tiền của hệ thống */
  refundRef: string;
  /** Mã giao dịch gốc của thanh toán */
  originalTxnRef: string;
  /** Số giao dịch VNPAY của thanh toán gốc */
  originalTransactionNo: string;
  /** Ngày thanh toán gốc của VNPAY */
  originalPayDate: string;
  /** Số tiền hoàn bằng VND */
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
  /** Cổng giả lập không cần số giao dịch gốc */
  requiresOriginalTransaction?(): boolean;
}

/** Gọi API hoàn tiền thật của VNPAY sandbox */
export class VnpayRefundGateway implements RefundGateway {
  async requestRefund(input: RefundRequestInput): Promise<RefundResult> {
    const now = new Date();
    const vnp_RequestId = input.refundRef;
    const vnp_Version = '2.1.0';
    const vnp_Command = 'refund';
    const vnp_TmnCode = env.VNPAY_TMN_CODE;
    const vnp_TransactionType = '02';
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
      // VNPAY từ chối với mã khác 00
      if (json?.vnp_ResponseCode) {
        return { success: false, message: json.vnp_Message ?? `VNPAY refund rejected (code ${json.vnp_ResponseCode})` };
      }
      return { success: false, message: `VNPAY refund gave no readable answer (HTTP ${res.status})` };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'VNPAY refund request failed' };
    }
  }
}
