import { Router } from 'express';
import { ReviewsController } from './reviews.controller';
import { authenticate, requireRole, requireAdmin } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validate.middleware';
import { ROLE_NAMES } from '../../common/constants/roles';
import { hotelIdParamSchema, publicReviewsQuerySchema, bookingIdParamSchema, reviewIdParamSchema, createReviewSchema, moderateReviewSchema, adminListReviewsQuerySchema } from './reviews.schemas';

const controller = new ReviewsController();

/** Khách đánh giá đơn hoàn tất của mình */
export const reviewsBookingRoutes = Router();

reviewsBookingRoutes.post(
  '/:id/review',
  authenticate,
  requireRole(ROLE_NAMES.CUSTOMER),
  validateRequest({ params: bookingIdParamSchema, body: createReviewSchema }),
  controller.create
);

reviewsBookingRoutes.get(
  '/:id/review',
  authenticate,
  requireRole(ROLE_NAMES.CUSTOMER),
  validateRequest({ params: bookingIdParamSchema }),
  controller.getMine
);

/** Đánh giá công khai của khách sạn */
export const hotelReviewsRoutes = Router();
hotelReviewsRoutes.get('/:id/reviews', validateRequest({ params: hotelIdParamSchema, query: publicReviewsQuerySchema }), controller.listPublic);

/** Kiểm duyệt dành riêng cho admin */
export const adminReviewsRoutes = Router();
adminReviewsRoutes.use(authenticate, requireAdmin);

adminReviewsRoutes.get('/', validateRequest({ query: adminListReviewsQuerySchema }), controller.adminList);
adminReviewsRoutes.get('/:id', validateRequest({ params: reviewIdParamSchema }), controller.adminGetById);
adminReviewsRoutes.patch(
  '/:id/moderate',
  validateRequest({ params: reviewIdParamSchema, body: moderateReviewSchema }),
  controller.moderate
);
// Xóa an toàn đặt đánh giá về Ẩn
adminReviewsRoutes.delete('/:id', validateRequest({ params: reviewIdParamSchema }), controller.remove);
