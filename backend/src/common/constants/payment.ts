/** Trạng thái thanh toán */
export const PAYMENT_STATUS = {
  PENDING: 'Chờ xử lý',
  SUCCESS: 'Thành công',
  FAILED: 'Thất bại',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

/** Phương thức thanh toán */
export const PAYMENT_METHOD = {
  VNPAY: 'VNPAY',
  /** Thanh toán giả lập, không qua cổng thật */
  VNPAY_SIMULATED: 'VNPAY (mô phỏng)',
} as const;

/** Trạng thái hoàn tiền */
export const REFUND_STATUS = {
  PENDING: 'Chờ xử lý',
  SUCCESS: 'Thành công',
  FAILED: 'Thất bại',
} as const;

export type RefundStatus = (typeof REFUND_STATUS)[keyof typeof REFUND_STATUS];
