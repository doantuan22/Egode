import { z } from 'zod';

export const ownerReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  /** Only reviews that gave exactly this many stars. */
  diemDanhGia: z.coerce.number().int().min(1).max(5).optional(),
});
export type OwnerReviewsQuery = z.infer<typeof ownerReviewsQuerySchema>;
