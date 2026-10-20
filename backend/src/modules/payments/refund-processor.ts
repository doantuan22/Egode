import { REFUND_STATUS } from '../../common/constants/payment';
import type { RefundGateway } from './refund-gateway';
import { ConfiguredRefundGateway } from './simulated-refund-gateway';
import { attemptGatewayRefund } from './refund-helper';
import { RefundsRepository, type PendingRefund } from './refunds.repository';

/** Gửi hoàn tiền tới cổng và cập nhật dòng hoàn tiền sau khi giao dịch đã commit */
export class RefundProcessor {
  constructor(
    private readonly gateway: RefundGateway = new ConfiguredRefundGateway(),
    private readonly repository: RefundsRepository = new RefundsRepository()
  ) {}

  async process(refund: PendingRefund, ipAddr: string): Promise<void> {
    const outcome = await attemptGatewayRefund(this.gateway, refund.packedOriginalRef, refund.refundRef, refund.amount, ipAddr);
    await this.repository.settle(refund.maHoanTien, outcome.success ? REFUND_STATUS.SUCCESS : REFUND_STATUS.FAILED, outcome.success ? new Date() : null);
  }
}
