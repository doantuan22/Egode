import { Router } from 'express';
import { LocationsController } from './locations.controller';

const router = Router();
const controller = new LocationsController();

// Dữ liệu công khai cho tìm kiếm và form đăng ký khách sạn
router.get('/', controller.list);

export default router;
