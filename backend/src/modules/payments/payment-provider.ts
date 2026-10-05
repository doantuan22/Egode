import { env } from '../../config/env';

export type PaymentProvider = 'simulated' | 'vnpay';

/**
 * Which payment backend is active. Read at call time (not at import) so a test can switch it.
 *  - simulated: no external gateway at all. Paying and refunding are completed inside our own backend and recorded
 *    in THANH_TOAN / HOAN_TIEN exactly like the real thing; the UI shows a processing animation and the result.
 *  - vnpay: the real VNPAY redirect / IPN / refund API flow (needs merchant credentials).
 * Development and tests default to `simulated`; production must choose explicitly (env.ts refuses to start otherwise).
 */
export const getPaymentProvider = (): PaymentProvider => env.PAYMENT_PROVIDER ?? 'simulated';
