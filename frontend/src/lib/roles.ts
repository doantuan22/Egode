// Tên các vai trò, khớp với backend
export const ROLE_NAMES = {
  CUSTOMER: 'Khách hàng',
  PARTNER: 'Chủ khách sạn',
  ADMIN: 'Quản trị hệ thống',
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];

/** Trang đích của từng vai trò sau khi đăng nhập */
export const ROLE_HOME: Record<string, string> = {
  [ROLE_NAMES.ADMIN]: '/admin',
  [ROLE_NAMES.PARTNER]: '/owner',
  [ROLE_NAMES.CUSTOMER]: '/',
};

/** Trang hồ sơ riêng của từng vai trò */
export const PROFILE_PATH: Record<string, string> = {
  [ROLE_NAMES.ADMIN]: '/admin/profile',
  [ROLE_NAMES.PARTNER]: '/owner/profile',
  [ROLE_NAMES.CUSTOMER]: '/profile',
};

export const profilePathFor = (role: string | null): string => (role && PROFILE_PATH[role]) || '/profile';
