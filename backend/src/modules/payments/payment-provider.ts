import { env } from '../../config/env';

export type PaymentProvider = 'simulated' | 'vnpay';

/** Chọn cách xử lý thanh toán: simulated hoặc vnpay */
export const getPaymentProvider = (): PaymentProvider => env.PAYMENT_PROVIDER ?? 'simulated';
