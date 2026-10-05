import type { RefundGateway, RefundRequestInput, RefundResult } from './refund-gateway';
import { VnpayRefundGateway } from './refund-gateway';
import { getPaymentProvider } from './payment-provider';

/** The simulated "gateway": the refund always goes through. Nothing leaves the process. */
export class SimulatedRefundGateway implements RefundGateway {
  requiresOriginalTransaction(): boolean {
    return false; // a simulated payment needs no VNPAY transaction number to be refunded
  }

  async requestRefund(input: RefundRequestInput): Promise<RefundResult> {
    return { success: true, message: `Hoàn tiền mô phỏng ${input.amount} VND cho giao dịch ${input.originalTxnRef}` };
  }
}

/** Picks the gateway per call from PAYMENT_PROVIDER, so the three-step refund flow is the same in both modes. */
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
