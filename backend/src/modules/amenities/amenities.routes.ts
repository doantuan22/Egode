import { Router } from 'express';
import { AmenitiesController } from './amenities.controller';

const router = Router();
const controller = new AmenitiesController();

// Danh sách tiện nghi công khai cho bộ lọc tìm kiếm
router.get('/', controller.list);

export default router;
