import { Router } from 'express';
import { AccountsController } from './accounts.controller';
import { authenticate, requireAdmin } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validate.middleware';
import {
  listAccountsQuerySchema,
  createAccountSchema,
  updateAccountSchema,
  accountIdParamSchema,
} from './accounts.schemas';

const router = Router();
const controller = new AccountsController();

router.use(authenticate, requireAdmin);

router.get('/', validateRequest({ query: listAccountsQuerySchema }), controller.list);
router.post('/', validateRequest({ body: createAccountSchema }), controller.create);
// Phải đứng trước '/:id'
router.get('/roles', controller.listRoles);
router.get('/:id', validateRequest({ params: accountIdParamSchema }), controller.getById);
router.patch(
  '/:id',
  validateRequest({ params: accountIdParamSchema, body: updateAccountSchema }),
  controller.update
);
router.post('/:id/lock', validateRequest({ params: accountIdParamSchema }), controller.lock);
router.post('/:id/unlock', validateRequest({ params: accountIdParamSchema }), controller.unlock);
router.delete('/:id', validateRequest({ params: accountIdParamSchema }), controller.remove);

export default router;
