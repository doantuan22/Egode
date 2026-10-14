import { Request, Response, NextFunction } from 'express';
import { HealthService } from './health.service';
import { sendError, sendSuccess } from '../../common/utils/response';

export class HealthController {
  constructor(private readonly healthService: HealthService = new HealthService()) {}

  getLiveness = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const healthData = await this.healthService.getHealthStatus(false);
      sendSuccess(res, healthData, 'Hotel Booking API is running');
    } catch (error) {
      next(error);
    }
  };

  getReadiness = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const healthData = await this.healthService.getHealthStatus(true);
      if (healthData.status !== 'ok') {
        sendError(res, 'Service unavailable', 503, healthData);
        return;
      }
      sendSuccess(res, healthData, 'Hotel Booking API is ready');
    } catch (error) {
      next(error);
    }
  };

  /** Backward-compatible endpoint: the legacy ?db=true flag now has readiness semantics. */
  getHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.query.db === 'true') return this.getReadiness(req, res, next);
    return this.getLiveness(req, res, next);
  };
}
