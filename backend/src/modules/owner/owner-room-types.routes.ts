import { Router } from 'express';
import { OwnerRoomTypesController } from './owner-room-types.controller';
import { OwnerRatesController } from './owner-rates.controller';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validate.middleware';
import { ROLE_NAMES } from '../../common/constants/roles';
import {
  updateRoomTypeSchema,
  roomTypeIdParamSchema,
  roomTypeImageIdParamSchema,
} from './owner-room-types.schemas';
import { replaceAmenitiesSchema, uploadImageSchema } from './owner-hotels.schemas';
import { listRatesQuerySchema, bulkUpsertRatesSchema } from './owner-rates.schemas';

const router = Router();
const controller = new OwnerRoomTypesController();
const ratesController = new OwnerRatesController();

router.use(authenticate, requireRole(ROLE_NAMES.PARTNER));

router.get('/:id', validateRequest({ params: roomTypeIdParamSchema }), controller.getOne);
router.patch(
  '/:id',
  validateRequest({ params: roomTypeIdParamSchema, body: updateRoomTypeSchema }),
  controller.update
);
router.post('/:id/deactivate', validateRequest({ params: roomTypeIdParamSchema }), controller.deactivate);
router.post('/:id/reactivate', validateRequest({ params: roomTypeIdParamSchema }), controller.reactivate);
router.put(
  '/:id/amenities',
  validateRequest({ params: roomTypeIdParamSchema, body: replaceAmenitiesSchema }),
  controller.replaceAmenities
);
router.post(
  '/:id/images',
  validateRequest({ params: roomTypeIdParamSchema, body: uploadImageSchema }),
  controller.addImage
);
router.patch(
  '/:id/images/:imageId',
  validateRequest({ params: roomTypeImageIdParamSchema }),
  controller.setPrimaryImage
);
router.delete(
  '/:id/images/:imageId',
  validateRequest({ params: roomTypeImageIdParamSchema }),
  controller.removeImage
);

// Inventory / pricing (QUY_PHONG_GIA)
router.get(
  '/:id/rates',
  validateRequest({ params: roomTypeIdParamSchema, query: listRatesQuerySchema }),
  ratesController.list
);
router.put(
  '/:id/rates',
  validateRequest({ params: roomTypeIdParamSchema, body: bulkUpsertRatesSchema }),
  ratesController.bulkUpsert
);

export default router;
