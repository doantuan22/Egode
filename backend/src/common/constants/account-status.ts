/** Trạng thái của tài khoản */
export const ACCOUNT_STATUS = {
  ACTIVE: 'Hoạt động',
  LOCKED: 'Khóa',
} as const;

export type AccountStatus = (typeof ACCOUNT_STATUS)[keyof typeof ACCOUNT_STATUS];

/** Trạng thái duyệt hồ sơ đối tác */
export const PARTNER_APPLICATION_STATUS = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
} as const;

export type PartnerApplicationStatus =
  (typeof PARTNER_APPLICATION_STATUS)[keyof typeof PARTNER_APPLICATION_STATUS];
