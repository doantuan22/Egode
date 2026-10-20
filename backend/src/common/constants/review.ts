/** Trạng thái đánh giá */
export const REVIEW_STATUS = {
  PENDING: 'Chờ duyệt',
  VISIBLE: 'Hiển thị',
  HIDDEN: 'Ẩn',
  VIOLATION: 'Vi phạm',
} as const;

export type ReviewStatus = (typeof REVIEW_STATUS)[keyof typeof REVIEW_STATUS];
