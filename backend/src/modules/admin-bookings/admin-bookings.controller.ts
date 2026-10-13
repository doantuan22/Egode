import type { NextFunction, Request, Response } from 'express';
import { sendPaginated, sendSuccess } from '../../common/utils/response';
import { AdminBookingsService } from './admin-bookings.service';
import type { AdminBookingsQuery } from './admin-bookings.schemas';

export class AdminBookingsController {
  constructor(private readonly service = new AdminBookingsService()) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.list(req.query as unknown as AdminBookingsQuery);
      sendPaginated(res, result.items, result.pagination);
    } catch (error) {
      next(error);
    }
  };

  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getOne(Number(req.params.id)));
    } catch (error) {
      next(error);
    }
  };
}
