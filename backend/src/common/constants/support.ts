/** Loại yêu cầu hỗ trợ */
export const SUPPORT_TYPE = {
  SUPPORT: 'Hỗ trợ',
  COMPLAINT: 'Khiếu nại',
} as const;

export type SupportType = (typeof SUPPORT_TYPE)[keyof typeof SUPPORT_TYPE];

/** Trạng thái yêu cầu hỗ trợ */
export const SUPPORT_STATUS = {
  NEW: 'Mới',
  IN_PROGRESS: 'Đang xử lý',
  RESOLVED: 'Đã xử lý',
} as const;

export type SupportStatus = (typeof SUPPORT_STATUS)[keyof typeof SUPPORT_STATUS];
