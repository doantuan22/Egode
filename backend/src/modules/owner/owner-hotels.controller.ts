import { Request, Response, NextFunction } from 'express';
import { OwnerHotelsService } from './owner-hotels.service';
import { sendSuccess } from '../../common/utils/response';
import { AppError } from '../../common/errors/app-error';

export class OwnerHotelsController {
  constructor(private readonly service: OwnerHotelsService = new OwnerHotelsService()) {}

  private ownerId(req: Request): number {
    if (!req.user) throw AppError.unauthorized();
    return req.user.maTaiKhoan;
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hotels = await this.service.listMine(this.ownerId(req));
      sendSuccess(res, hotels);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hotel = await this.service.create(this.ownerId(req), req.body);
      sendSuccess(res, hotel, 'Đăng ký khách sạn thành công, đang chờ quản trị viên duyệt', 201);
    } catch (error) {
      next(error);
    }
  };

  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const hotel = await this.service.getOwnedHotel(this.ownerId(req), id);
      sendSuccess(res, hotel);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const hotel = await this.service.update(this.ownerId(req), id, req.body);
      sendSuccess(res, hotel, 'Cập nhật khách sạn thành công');
    } catch (error) {
      next(error);
    }
  };

  reactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const hotel = await this.service.reactivate(this.ownerId(req), id);
      sendSuccess(res, hotel, 'Khách sạn đã hoạt động trở lại');
    } catch (error) {
      next(error);
    }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const hotel = await this.service.deactivate(this.ownerId(req), id);
      sendSuccess(res, hotel, 'Khách sạn đã ngừng kinh doanh; dữ liệu lịch sử được giữ lại');
    } catch (error) {
      next(error);
    }
  };

  replaceAmenities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const hotel = await this.service.replaceAmenities(this.ownerId(req), id, req.body.amenityIds);
      sendSuccess(res, hotel, 'Cập nhật tiện nghi thành công');
    } catch (error) {
      next(error);
    }
  };

  addImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const image = await this.service.addImage(this.ownerId(req), id, req.body.image);
      sendSuccess(res, image, 'Tải ảnh lên thành công', 201);
    } catch (error) {
      next(error);
    }
  };

  removeImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, imageId } = req.params as unknown as { id: number; imageId: number };
      await this.service.removeImage(this.ownerId(req), id, imageId);
      sendSuccess(res, undefined, 'Đã xóa hình ảnh');
    } catch (error) {
      next(error);
    }
  };

  setPrimaryImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, imageId } = req.params as unknown as { id: number; imageId: number };
      const hotel = await this.service.setPrimaryImage(this.ownerId(req), id, imageId);
      sendSuccess(res, hotel, 'Đã đặt làm ảnh đại diện');
    } catch (error) {
      next(error);
    }
  };
}
