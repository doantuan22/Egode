import { Router } from 'express';
import { OwnerAnalyticsController } from './owner-analytics.controller';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validate.middleware';
import { ROLE_NAMES } from '../../common/constants/roles';
import { hotelIdParamSchema } from './owner-hotels.schemas';
import { dateRangeQuerySchema } from '../analytics/date-range';

/** Thống kê của khách sạn thuộc chủ sở hữu */
const router = Router();
const controller = new OwnerAnalyticsController();

router.get(
  '/:id/analytics',
  authenticate,
  requireRole(ROLE_NAMES.PARTNER),
  validateRequest({ params: hotelIdParamSchema, query: dateRangeQuerySchema }),
  controller.getHotelAnalytics
);

export default router;
