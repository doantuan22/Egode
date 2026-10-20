import { Router } from 'express';
import { z } from 'zod';
import { CancellationPoliciesController } from './cancellation-policies.controller';
import { validateRequest } from '../../middleware/validate.middleware';

const router = Router();
const controller = new CancellationPoliciesController();
const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

// Dữ liệu công khai, chỉ đọc
router.get('/', controller.list);
router.get('/:id', validateRequest({ params: idParamSchema }), controller.getOne);

export default router;
