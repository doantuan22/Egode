import { z } from 'zod';
import { REVIEW_STATUS } from '../../common/constants/review';
import { MAX_REVIEW_IMAGES } from './review-images';

export const bookingIdParamSchema = z.object({ id: z.coerce.number().int().positive() });
export const reviewIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const createReviewSchema = z.object({
  diemDanhGia: z.coerce.number().int().min(1, 'Điểm đánh giá phải từ 1 đến 5').max(5, 'Điểm đánh giá phải từ 1 đến 5'),
  noiDung: z.string().trim().max(2000).optional(),
  // Data URIs — validated for real (type/size) in review-images.ts, this only bounds the array length cheaply.
  hinhAnh: z.array(z.string()).max(MAX_REVIEW_IMAGES).optional(),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const moderateReviewSchema = z.object({
  trangThai: z.enum([REVIEW_STATUS.VISIBLE, REVIEW_STATUS.HIDDEN, REVIEW_STATUS.VIOLATION]),
});
export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;

export const hotelIdParamSchema = z.object({ id: z.coerce.number().int().positive() });
export const publicReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type PublicReviewsQuery = z.infer<typeof publicReviewsQuerySchema>;

export const adminListReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).optional(),
  trangThai: z.string().max(30).optional(),
  diemDanhGia: z.coerce.number().int().min(1).max(5).optional(),
});
export type AdminListReviewsQuery = z.infer<typeof adminListReviewsQuerySchema>;
