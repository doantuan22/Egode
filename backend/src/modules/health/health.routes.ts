import { Router } from 'express';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

export const createHealthRouter = (healthService?: HealthService): Router => {
  const router = Router();
  const controller = new HealthController(healthService);

  router.get('/health', controller.getHealth);
  router.get('/health/live', controller.getLiveness);
  router.get('/health/ready', controller.getReadiness);

  return router;
};

export default createHealthRouter();
