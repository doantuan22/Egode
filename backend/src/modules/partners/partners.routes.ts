import { Router } from 'express';
import { PartnersController } from './partners.controller';
import { authenticate, requireAdmin, requireRoleAllowingPendingPartner } from '../../middleware/auth.middleware';
import { ROLE_NAMES } from '../../common/constants/roles';
import { validateRequest } from '../../middleware/validate.middleware';
import { applyPartnerSchema, adminListPartnerApplicationsQuerySchema, partnerApplicationIdParamSchema, rejectPartnerApplicationSchema } from './partners.schemas';

const router = Router();
const controller = new PartnersController();

router.use(authenticate);
router.post('/apply', requireRoleAllowingPendingPartner(ROLE_NAMES.CUSTOMER), validateRequest({ body: applyPartnerSchema }), controller.apply);
router.get('/me', controller.getMine);

export const adminPartnerApplicationRoutes = Router();
adminPartnerApplicationRoutes.use(authenticate, requireAdmin);
adminPartnerApplicationRoutes.get('/', validateRequest({ query: adminListPartnerApplicationsQuerySchema }), controller.adminList);
adminPartnerApplicationRoutes.get('/:id', validateRequest({ params: partnerApplicationIdParamSchema }), controller.adminGetById);
adminPartnerApplicationRoutes.post('/:id/approve', validateRequest({ params: partnerApplicationIdParamSchema }), controller.approve);
adminPartnerApplicationRoutes.post('/:id/reject', validateRequest({ params: partnerApplicationIdParamSchema, body: rejectPartnerApplicationSchema }), controller.reject);

export default router;
