/** Trạng thái khuyến mãi */
export const PROMOTION_STATUS = {
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Ngừng',
} as const;

export type PromotionStatus = (typeof PROMOTION_STATUS)[keyof typeof PROMOTION_STATUS];

/** Loại giảm giá của khuyến mãi */
export const DISCOUNT_TYPE = {
  PERCENT: 'Phần trăm',
  FIXED_AMOUNT: 'Số tiền cố định',
} as const;

/** Phạm vi áp dụng khuyến mãi */
export const PROMOTION_SCOPE = {
  SYSTEM_WIDE: 'Toàn hệ thống',
  SCOPED: 'Theo phạm vi',
} as const;

/** Trạng thái chính sách hủy */
export const CANCELLATION_POLICY_STATUS = {
  ACTIVE: 'Hoạt động',
} as const;
