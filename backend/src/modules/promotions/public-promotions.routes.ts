import { Router, Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../common/utils/response';
import { PublicPromotionsService } from './public-promotions.service';

const router = Router();
const service = new PublicPromotionsService();

// Public, read-only — the promo picker of the booking panel. Admin management stays under /admin/promotions.
router.get('/available', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await service.listAvailable());
  } catch (error) {
    next(error);
  }
});

export default router;
