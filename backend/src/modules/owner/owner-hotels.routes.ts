import { Router } from 'express';
import { OwnerHotelsController } from './owner-hotels.controller';
import { OwnerRoomTypesController } from './owner-room-types.controller';
import { OwnerBookingsController } from './owner-bookings.controller';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validate.middleware';
import { ROLE_NAMES } from '../../common/constants/roles';
import {
  createHotelSchema,
  updateHotelSchema,
  hotelIdParamSchema,
  hotelImageIdParamSchema,
  replaceAmenitiesSchema,
  uploadImageSchema,
} from './owner-hotels.schemas';
import { createRoomTypeSchema, hotelIdParamSchema as roomTypeHotelIdParamSchema } from './owner-room-types.schemas';
import { ownerBookingsQuerySchema, ownerBookingParamsSchema } from './owner-bookings.schemas';

const router = Router();
const controller = new OwnerHotelsController();
const roomTypesController = new OwnerRoomTypesController();
const bookingsController = new OwnerBookingsController();

router.use(authenticate, requireRole(ROLE_NAMES.PARTNER));

router.get('/', controller.list);
router.post('/', validateRequest({ body: createHotelSchema }), controller.create);
router.get('/:id', validateRequest({ params: hotelIdParamSchema }), controller.getOne);
router.patch(
  '/:id',
  validateRequest({ params: hotelIdParamSchema, body: updateHotelSchema }),
  controller.update
);
router.post('/:id/deactivate', validateRequest({ params: hotelIdParamSchema }), controller.deactivate);
router.post('/:id/reactivate', validateRequest({ params: hotelIdParamSchema }), controller.reactivate);
router.put(
  '/:id/amenities',
  validateRequest({ params: hotelIdParamSchema, body: replaceAmenitiesSchema }),
  controller.replaceAmenities
);
router.post(
  '/:id/images',
  validateRequest({ params: hotelIdParamSchema, body: uploadImageSchema }),
  controller.addImage
);
router.get(
  '/:hotelId/bookings',
  validateRequest({ params: roomTypeHotelIdParamSchema, query: ownerBookingsQuerySchema }),
  bookingsController.list
);
router.get(
  '/:hotelId/bookings/:bookingId',
  validateRequest({ params: ownerBookingParamsSchema }),
  bookingsController.getOne
);
router.patch(
  '/:id/images/:imageId',
  validateRequest({ params: hotelImageIdParamSchema }),
  controller.setPrimaryImage
);
router.delete(
  '/:id/images/:imageId',
  validateRequest({ params: hotelImageIdParamSchema }),
  controller.removeImage
);

// Room types nested under their hotel — item-level operations live at /owner/room-types/:id
router.get(
  '/:hotelId/room-types',
  validateRequest({ params: roomTypeHotelIdParamSchema }),
  roomTypesController.listForHotel
);
router.post(
  '/:hotelId/room-types',
  validateRequest({ params: roomTypeHotelIdParamSchema, body: createRoomTypeSchema }),
  roomTypesController.create
);

export default router;
