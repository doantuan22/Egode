/** Tên các vai trò trong hệ thống */
export const ROLE_NAMES = {
  CUSTOMER: 'Khách hàng',
  PARTNER: 'Chủ khách sạn',
  ADMIN: 'Quản trị hệ thống',
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];
