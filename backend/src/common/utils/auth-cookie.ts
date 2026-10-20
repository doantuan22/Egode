export type CookieSameSite = 'lax' | 'strict' | 'none';

/** Tính cấu hình cookie refresh token theo môi trường */
export const refreshCookieBaseOptions = (nodeEnv: string, sameSite: CookieSameSite = 'lax') => ({
  httpOnly: true,
  secure: nodeEnv === 'production' || sameSite === 'none',
  sameSite,
  path: '/api/auth',
});
