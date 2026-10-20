import type { RefundGateway, RefundRequestInput, RefundResult } from '../modules/payments/refund-gateway';

/** Cổng hoàn tiền giả để test không gọi mạng */
export class FakeRefundGateway implements RefundGateway {
  public calls: RefundRequestInput[] = [];
  constructor(private readonly result: RefundResult = { success: true, message: 'OK (fake)' }) {}

  async requestRefund(input: RefundRequestInput): Promise<RefundResult> {
    this.calls.push(input);
    return this.result;
  }
}
