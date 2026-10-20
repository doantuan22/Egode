import type { RefundGateway, RefundRequestInput, RefundResult } from './refund-gateway';
import { VnpayRefundGateway } from './refund-gateway';
import { getPaymentProvider } from './payment-provider';

/** Cổng giả lập luôn hoàn tiền thành công */
export class SimulatedRefundGateway implements RefundGateway {
  requiresOriginalTransaction(): boolean {
    return false;
  }

  async requestRefund(input: RefundRequestInput): Promise<RefundResult> {
    return { success: true, message: `Hoàn tiền mô phỏng ${input.amount} VND cho giao dịch ${input.originalTxnRef}` };
  }
}

/** Chọn cổng hoàn tiền theo PAYMENT_PROVIDER */
export class ConfiguredRefundGateway implements RefundGateway {
  private readonly simulated = new SimulatedRefundGateway();
  private readonly vnpay = new VnpayRefundGateway();

  private active(): RefundGateway {
    return getPaymentProvider() === 'simulated' ? this.simulated : this.vnpay;
  }

  requiresOriginalTransaction(): boolean {
    return this.active().requiresOriginalTransaction?.() ?? true;
  }

  requestRefund(input: RefundRequestInput): Promise<RefundResult> {
    return this.active().requestRefund(input);
  }
}
