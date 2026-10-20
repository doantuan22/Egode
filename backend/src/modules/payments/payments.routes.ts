import { Router } from 'express';
import { PaymentsController } from './payments.controller';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validate.middleware';
import { ROLE_NAMES } from '../../common/constants/roles';
import { bookingIdParamSchema, refundIdParamSchema } from './payments.schemas';
import { createRateLimiter } from '../../middleware/security.middleware';

const controller = new PaymentsController();
const callbackLimiter = createRateLimiter({ windowMs: 60_000, max: 300, keyPrefix: 'payment-callback' });
const paymentActionLimiter = createRateLimiter({ windowMs: 60_000, max: 20, keyPrefix: 'payment-action' });
const applyOutsideTests = (middleware: ReturnType<typeof createRateLimiter>) =>
  process.env.NODE_ENV === 'test' ? (_req: unknown, _res: unknown, next: () => void) => next() : middleware;

/** Thanh toán cho đơn của chính khách */
export const paymentsBookingRoutes = Router();

paymentsBookingRoutes.post(
  '/:id/payments/vnpay',
  applyOutsideTests(paymentActionLimiter),
  authenticate,
  requireRole(ROLE_NAMES.CUSTOMER),
  validateRequest({ params: bookingIdParamSchema }),
  controller.createVnpayPayment
);

paymentsBookingRoutes.post(
  '/:id/payments/simulate',
  applyOutsideTests(paymentActionLimiter),
  authenticate,
  requireRole(ROLE_NAMES.CUSTOMER),
  validateRequest({ params: bookingIdParamSchema }),
  controller.paySimulated
);

paymentsBookingRoutes.get(
  '/:id/payments/status',
  authenticate,
  requireRole(ROLE_NAMES.CUSTOMER),
  validateRequest({ params: bookingIdParamSchema }),
  controller.getStatus
);

/** Endpoint cho VNPAY, xác thực bằng chữ ký */
export const paymentsGatewayRoutes = Router();

paymentsGatewayRoutes.get('/config', controller.getConfig);
paymentsGatewayRoutes.get('/vnpay-return', applyOutsideTests(callbackLimiter), controller.vnpayReturn);
paymentsGatewayRoutes.get('/vnpay-ipn', applyOutsideTests(callbackLimiter), controller.vnpayIpn);

/** Thử lại hoàn tiền do khách yêu cầu */
paymentsGatewayRoutes.post(
  '/refunds/:id/retry',
  applyOutsideTests(paymentActionLimiter),
  authenticate,
  requireRole(ROLE_NAMES.CUSTOMER),
  validateRequest({ params: refundIdParamSchema }),
  controller.retryRefund
);
