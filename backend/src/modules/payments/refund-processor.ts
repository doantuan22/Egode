import { REFUND_STATUS } from '../../common/constants/payment';
import type { RefundGateway } from './refund-gateway';
import { VnpayRefundGateway } from './refund-gateway';
import { attemptGatewayRefund } from './refund-helper';
import { RefundsRepository, type PendingRefund } from './refunds.repository';

/**
 * Steps 2 and 3 of a refund: send it to the gateway, then settle the HOAN_TIEN row. Call it only AFTER the
 * transaction that created/claimed the refund has committed — it never runs inside one.
 *
 *   success                    → "Thành công", NgayHoanTien = now
 *   rejected / no answer / error → "Thất bại",   NgayHoanTien stays NULL
 * A call that got no answer (timeout, network error) is settled as "Thất bại" too: the row is then retryable
 * and a retry re-sends the SAME refund id, so the gateway can recognise a refund it already processed.
 * The booking is never touched here: cancelling is final, the refund has its own lifecycle.
 *
 * "Chờ xử lý" therefore means exactly one thing — an attempt was started and has not been settled. HOAN_TIEN
 * has no timestamp for "when did that attempt start", so a "Chờ xử lý" row left behind by a process that died
 * between commit and settle cannot be told apart from one still running (see FIX_VERIFICATION_REPORT, Bug #8).
 */
export class RefundProcessor {
  constructor(
    private readonly gateway: RefundGateway = new VnpayRefundGateway(),
    private readonly repository: RefundsRepository = new RefundsRepository()
  ) {}

  async process(refund: PendingRefund, ipAddr: string): Promise<void> {
    const outcome = await attemptGatewayRefund(this.gateway, refund.packedOriginalRef, refund.refundRef, refund.amount, ipAddr);
    await this.repository.settle(refund.maHoanTien, outcome.success ? REFUND_STATUS.SUCCESS : REFUND_STATUS.FAILED, outcome.success ? new Date() : null);
  }
}
