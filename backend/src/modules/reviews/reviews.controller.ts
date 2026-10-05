import { Request, Response, NextFunction } from 'express';
import { ReviewsService } from './reviews.service';
import { sendSuccess, sendPaginated } from '../../common/utils/response';
import type { CreateReviewInput, ModerateReviewInput, AdminListReviewsQuery, PublicReviewsQuery } from './reviews.schemas';

export class ReviewsController {
  constructor(private readonly service: ReviewsService = new ReviewsService()) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const review = await this.service.createReview(id, req.user!.maTaiKhoan, req.body as CreateReviewInput);
      sendSuccess(res, review, 'Gửi đánh giá thành công', 201);
    } catch (error) {
      next(error);
    }
  };

  getMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const review = await this.service.getMyReview(id, req.user!.maTaiKhoan);
      sendSuccess(res, review);
    } catch (error) {
      next(error);
    }
  };

  /** GET /hotels/:id/reviews — public, no sign-in needed. */
  listPublic = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const { items, summary, pagination } = await this.service.listPublicForHotel(id, req.query as unknown as PublicReviewsQuery);
      res.json({ success: true, data: items, summary, pagination });
    } catch (error) {
      next(error);
    }
  };

  adminList = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { items, pagination } = await this.service.adminList(req.query as unknown as AdminListReviewsQuery);
      sendPaginated(res, items, pagination);
    } catch (error) {
      next(error);
    }
  };

  adminGetById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const review = await this.service.adminGetById(id);
      sendSuccess(res, review);
    } catch (error) {
      next(error);
    }
  };

  moderate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const { trangThai } = req.body as ModerateReviewInput;
      const review = await this.service.moderate(id, trangThai);
      sendSuccess(res, review, 'Cập nhật trạng thái đánh giá thành công');
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const review = await this.service.removeViolation(id);
      sendSuccess(res, review, 'Đã gỡ đánh giá vi phạm khỏi phần hiển thị công khai');
    } catch (error) {
      next(error);
    }
  };
}
