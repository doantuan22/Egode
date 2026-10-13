/**
 * DANH_GIA.TrangThai — open domain (no CK constraint), per
 * database/DATABASE_SOURCE_CHAPTER_6_7.md §6.20: "Hiển thị, Ẩn, Vi phạm,...".
 * New reviews are created `VISIBLE` — there is no pre-moderation step; the
 * admin moderates after the fact (hide / mark as violation / restore).
 * `PENDING` ("Chờ duyệt") is no longer assigned to anything: it only remains
 * so rows written before that change are still understood and can be moved
 * to another state by an admin.
 */
export const REVIEW_STATUS = {
  PENDING: 'Chờ duyệt',
  VISIBLE: 'Hiển thị',
  HIDDEN: 'Ẩn',
  VIOLATION: 'Vi phạm',
} as const;

export type ReviewStatus = (typeof REVIEW_STATUS)[keyof typeof REVIEW_STATUS];
