import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../common/errors/app-error';
import { sendPaginated } from '../../common/utils/response';
import { OwnerReviewsService } from './owner-reviews.service';
import type { OwnerReviewsQuery } from './owner-reviews.schemas';

export class OwnerReviewsController {
  constructor(private readonly service: OwnerReviewsService = new OwnerReviewsService()) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw AppError.unauthorized();
      const { id } = req.params as unknown as { id: number };
      const result = await this.service.list(req.user.maTaiKhoan, id, req.query as unknown as OwnerReviewsQuery);
      // `summary` rides next to `data` and `pagination`, the same envelope GET /hotels/:id/reviews uses.
      res.status(200).json({ success: true, data: result.items, pagination: result.pagination, summary: result.summary });
    } catch (error) {
      next(error);
    }
  };
}
