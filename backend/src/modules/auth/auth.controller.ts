import { Request, Response, NextFunction } from 'express';
import { AuthService, AuthResult } from './auth.service';
import { sendSuccess } from '../../common/utils/response';
import { AppError } from '../../common/errors/app-error';
import { env } from '../../config/env';
import { refreshCookieBaseOptions } from '../../common/utils/auth-cookie';
import {
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
} from '../../common/utils/jwt';

// BUG-006: the single source of truth for the refresh cookie. Everything that decides WHERE the
// cookie lives and HOW it is protected (path/domain/httpOnly/secure/sameSite) is here and is used
// for both setting and clearing, so the two can never drift apart. No `domain` is set today:
// the cookie is host-only. If one is ever added, add it here and login/logout both follow.
const REFRESH_COOKIE_BASE_OPTIONS = refreshCookieBaseOptions(env.NODE_ENV, env.REFRESH_COOKIE_SAMESITE);

// Only setting a cookie carries a lifetime; clearing must not (it expires the cookie immediately).
const REFRESH_COOKIE_OPTIONS = {
  ...REFRESH_COOKIE_BASE_OPTIONS,
  maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
};

export class AuthController {
  constructor(private readonly authService: AuthService = new AuthService()) {}

  private sendAuthResult = (res: Response, result: AuthResult, message: string, statusCode = 200) => {
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, result.tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    sendSuccess(
      res,
      { account: result.account, accessToken: result.tokens.accessToken },
      message,
      statusCode
    );
  };

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.register(req.body);
      this.sendAuthResult(res, result, 'Đăng ký tài khoản thành công', 201);
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.login(req.body);
      this.sendAuthResult(res, result, 'Đăng nhập thành công');
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
      if (!refreshToken) {
        throw AppError.unauthorized('Không tìm thấy refresh token');
      }
      const tokens = await this.authService.refresh(refreshToken);
      res.cookie(REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
      sendSuccess(res, { accessToken: tokens.accessToken }, 'Làm mới token thành công');
    } catch (error) {
      // A refresh token the server refused (expired, stale after a password change, locked
      // account) is dead weight: drop the cookie, with the same attributes it was set with.
      if (error instanceof AppError && error.statusCode === 401) {
        res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, REFRESH_COOKIE_BASE_OPTIONS);
      }
      next(error);
    }
  };

  logout = async (_req: Request, res: Response): Promise<void> => {
    // No REFRESH_TOKEN table exists (Gate 0) — logout is stateless: clearing
    // the httpOnly cookie is the whole strategy. The token itself remains
    // cryptographically valid until it naturally expires (<=7 days).
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, REFRESH_COOKIE_BASE_OPTIONS);
    sendSuccess(res, undefined, 'Đăng xuất thành công');
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.authService.forgotPassword(req.body);
      sendSuccess(
        res,
        undefined,
        'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi'
      );
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.authService.resetPassword(req.body);
      sendSuccess(res, undefined, 'Đặt lại mật khẩu thành công');
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // `authenticate` guarantees req.user; guard anyway so a mis-wired route fails closed.
      if (!req.user) throw AppError.unauthorized('Authentication required');
      const tokens = await this.authService.changePassword(req.user.maTaiKhoan, req.body);
      // Replace this device's refresh cookie with one bound to the new password.
      res.cookie(REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
      sendSuccess(res, { accessToken: tokens.accessToken }, 'Đổi mật khẩu thành công');
    } catch (error) {
      next(error);
    }
  };
}
