import { Request, Response, NextFunction } from 'express';
import { sendPaginated, sendSuccess } from '../../common/utils/response';
import { AppError } from '../../common/errors/app-error';
import { AdminHotelsService } from './admin-hotels.service';

export class AdminHotelsController {
  constructor(private readonly service = new AdminHotelsService()) {}

  private id(req: Request): number {
    return Number(req.params.id);
  }

  private adminId(req: Request): number {
    if (!req.user) throw AppError.unauthorized();
    return req.user.maTaiKhoan;
  }

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = await this.service.list(req.query as never);
      sendPaginated(res, r.items, r.pagination);
    } catch (e) {
      next(e);
    }
  };

  getOne = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.getOne(this.id(req)));
    } catch (e) {
      next(e);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.update(this.id(req), req.body), 'Cập nhật khách sạn thành công');
    } catch (e) {
      next(e);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.approve(this.id(req), this.adminId(req)), 'Đã duyệt khách sạn');
    } catch (e) {
      next(e);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.reject(this.id(req)), 'Đã từ chối khách sạn');
    } catch (e) {
      next(e);
    }
  };

  suspend = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.suspend(this.id(req), req.ip ?? '127.0.0.1'), 'Đã đình chỉ khách sạn');
    } catch (e) {
      next(e);
    }
  };

  reactivate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.reactivate(this.id(req)), 'Đã kích hoạt lại khách sạn');
    } catch (e) {
      next(e);
    }
  };

  listAmenities = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.listAmenities());
    } catch (e) {
      next(e);
    }
  };

  createAmenity = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.createAmenity(req.body), 'Đã thêm tiện nghi', 201);
    } catch (e) {
      next(e);
    }
  };

  updateAmenity = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.updateAmenity(this.id(req), req.body), 'Đã cập nhật tiện nghi');
    } catch (e) {
      next(e);
    }
  };

  deleteAmenity = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.deleteAmenity(this.id(req));
      sendSuccess(res, undefined, 'Đã xóa tiện nghi');
    } catch (e) {
      next(e);
    }
  };
}
