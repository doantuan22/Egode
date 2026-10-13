import { Request, Response, NextFunction } from 'express';
import { OwnerRoomTypesService } from './owner-room-types.service';
import { sendSuccess } from '../../common/utils/response';
import { AppError } from '../../common/errors/app-error';

export class OwnerRoomTypesController {
  constructor(private readonly service: OwnerRoomTypesService = new OwnerRoomTypesService()) {}

  private ownerId(req: Request): number {
    if (!req.user) throw AppError.unauthorized();
    return req.user.maTaiKhoan;
  }

  listForHotel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { hotelId } = req.params as unknown as { hotelId: number };
      const roomTypes = await this.service.listForHotel(this.ownerId(req), hotelId);
      sendSuccess(res, roomTypes);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { hotelId } = req.params as unknown as { hotelId: number };
      const roomType = await this.service.create(this.ownerId(req), hotelId, req.body);
      sendSuccess(res, roomType, 'Tạo loại phòng thành công', 201);
    } catch (error) {
      next(error);
    }
  };

  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const roomType = await this.service.getOwnedRoomType(this.ownerId(req), id);
      sendSuccess(res, roomType);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const roomType = await this.service.update(this.ownerId(req), id, req.body);
      sendSuccess(res, roomType, 'Cập nhật loại phòng thành công');
    } catch (error) {
      next(error);
    }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const roomType = await this.service.deactivate(this.ownerId(req), id);
      sendSuccess(res, roomType, 'Loại phòng đã ngừng bán; dữ liệu lịch sử được giữ lại');
    } catch (error) {
      next(error);
    }
  };

  reactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const roomType = await this.service.reactivate(this.ownerId(req), id);
      sendSuccess(res, roomType, 'Loại phòng đã được mở bán lại');
    } catch (error) {
      next(error);
    }
  };

  replaceAmenities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const roomType = await this.service.replaceAmenities(this.ownerId(req), id, req.body.amenityIds);
      sendSuccess(res, roomType, 'Cập nhật tiện nghi thành công');
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
      const roomType = await this.service.setPrimaryImage(this.ownerId(req), id, imageId);
      sendSuccess(res, roomType, 'Đã đặt làm ảnh đại diện');
    } catch (error) {
      next(error);
    }
  };
}
