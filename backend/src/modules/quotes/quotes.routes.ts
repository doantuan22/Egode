import { Router } from 'express';
import { QuotesController } from './quotes.controller';
import { validateRequest } from '../../middleware/validate.middleware';
import { quoteRequestSchema, hotelIdParamSchema } from './quotes.schemas';

const router = Router();
const controller = new QuotesController();

// Tính toán công khai, không tạo đơn
router.post(
  '/:id/quote',
  validateRequest({ params: hotelIdParamSchema, body: quoteRequestSchema }),
  controller.create
);

export default router;
