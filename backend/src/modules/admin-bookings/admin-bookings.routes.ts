import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validate.middleware';
import { AdminBookingsController } from './admin-bookings.controller';
import { adminBookingIdSchema, adminBookingsQuerySchema } from './admin-bookings.schemas';

const router = Router();
const controller = new AdminBookingsController();

router.use(authenticate, requireAdmin);
router.get('/', validateRequest({ query: adminBookingsQuerySchema }), controller.list);
router.get('/:id', validateRequest({ params: adminBookingIdSchema }), controller.getOne);

export default router;
