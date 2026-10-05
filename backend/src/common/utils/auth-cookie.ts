export type CookieSameSite = 'lax' | 'strict' | 'none';

/**
 * The refresh-token cookie policy, as a pure function of the environment so every combination can be tested.
 *
 *  - same-site deployment (SPA and API on the same registrable domain, or behind one reverse proxy): `lax` (default).
 *  - cross-site deployment (SPA and API on different registrable domains): the browser only sends the cookie on the
 *    SPA's credentialed fetch when it is `SameSite=None; Secure`, so `none` forces Secure on. CORS must then allow the
 *    exact SPA origin with credentials (never `*`), and the cookie endpoints verify the request Origin (see
 *    trusted-origin.middleware.ts).
 */
export const refreshCookieBaseOptions = (nodeEnv: string, sameSite: CookieSameSite = 'lax') => ({
  httpOnly: true,
  secure: nodeEnv === 'production' || sameSite === 'none',
  sameSite,
  path: '/api/auth',
});
