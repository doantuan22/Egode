import { z } from 'zod';
import { DISCOUNT_TYPE, PROMOTION_STATUS } from '../../common/constants/commercial';

export const promotionIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

// Khoảng giá trị khớp ràng buộc CHECK của CSDL
export const createPromotionSchema = z.object({
  MaCode: z
    .string()
    .trim()
    .min(3, 'Mã phải có ít nhất 3 ký tự')
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, 'Mã chỉ gồm chữ, số, gạch ngang hoặc gạch dưới'),
  LoaiGiamGia: z.enum([DISCOUNT_TYPE.PERCENT, DISCOUNT_TYPE.FIXED_AMOUNT]),
  GiaTriGiam: z.coerce.number().positive('Giá trị giảm phải lớn hơn 0'),
  GiaTriDonToiThieu: z.coerce.number().min(0).default(0),
  MucGiamToiDa: z.coerce.number().min(0).default(0),
  SoLuongGioiHan: z.coerce.number().int().min(0).default(0),
  NgayBatDau: z.coerce.date(),
  NgayKetThuc: z.coerce.date(),
});
export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;

export const updatePromotionSchema = z
  .object({
    MaCode: z
      .string()
      .trim()
      .min(3)
      .max(50)
      .regex(/^[A-Za-z0-9_-]+$/, 'Mã chỉ gồm chữ, số, gạch ngang hoặc gạch dưới'),
    LoaiGiamGia: z.enum([DISCOUNT_TYPE.PERCENT, DISCOUNT_TYPE.FIXED_AMOUNT]),
    GiaTriGiam: z.coerce.number().positive(),
    GiaTriDonToiThieu: z.coerce.number().min(0),
    MucGiamToiDa: z.coerce.number().min(0),
    SoLuongGioiHan: z.coerce.number().int().min(0),
    NgayBatDau: z.coerce.date(),
    NgayKetThuc: z.coerce.date(),
  })
  .partial();
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;

export const listPromotionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(50).optional(),
  TrangThai: z.enum([PROMOTION_STATUS.ACTIVE, PROMOTION_STATUS.INACTIVE]).optional(),
  LoaiGiamGia: z.enum([DISCOUNT_TYPE.PERCENT, DISCOUNT_TYPE.FIXED_AMOUNT]).optional(),
});
export type ListPromotionsQuery = z.infer<typeof listPromotionsQuerySchema>;
