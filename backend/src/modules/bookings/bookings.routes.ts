import { Router } from 'express';
import { BookingsController } from './bookings.controller';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validate.middleware';
import { ROLE_NAMES } from '../../common/constants/roles';
import { createBookingSchema, hotelIdParamSchema, bookingIdParamSchema, cancelBookingSchema } from './bookings.schemas';

const controller = new BookingsController();

const router = Router();

// Chỉ khách đã đăng nhập mới đặt phòng
router.post(
  '/:id/bookings',
  authenticate,
  requireRole(ROLE_NAMES.CUSTOMER),
  validateRequest({ params: hotelIdParamSchema, body: createBookingSchema }),
  controller.create
);

export default router;

/** Các endpoint đặt phòng của khách, luôn kiểm tra quyền sở hữu */
export const myBookingsRoutes = Router();

myBookingsRoutes.get('/', authenticate, requireRole(ROLE_NAMES.CUSTOMER), controller.listMine);

myBookingsRoutes.get(
  '/:id',
  authenticate,
  requireRole(ROLE_NAMES.CUSTOMER),
  validateRequest({ params: bookingIdParamSchema }),
  controller.getOne
);

myBookingsRoutes.post(
  '/:id/cancel',
  authenticate,
  requireRole(ROLE_NAMES.CUSTOMER),
  validateRequest({ params: bookingIdParamSchema, body: cancelBookingSchema }),
  controller.cancel
);
