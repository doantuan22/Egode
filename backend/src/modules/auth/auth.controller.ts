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

// Cấu hình cookie refresh dùng chung cho đặt và xóa
const REFRESH_COOKIE_BASE_OPTIONS = refreshCookieBaseOptions(env.NODE_ENV, env.REFRESH_COOKIE_SAMESITE);

// Chỉ khi đặt cookie mới có thời hạn
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
      // Refresh token bị từ chối thì xóa cookie
      if (error instanceof AppError && error.statusCode === 401) {
        res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, REFRESH_COOKIE_BASE_OPTIONS);
      }
      next(error);
    }
  };

  logout = async (_req: Request, res: Response): Promise<void> => {
    // Đăng xuất chỉ cần xóa cookie
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
      // Chặn khi route thiếu xác thực
      if (!req.user) throw AppError.unauthorized('Authentication required');
      const tokens = await this.authService.changePassword(req.user.maTaiKhoan, req.body);
      // Cấp cookie refresh mới gắn với mật khẩu mới
      res.cookie(REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
      sendSuccess(res, { accessToken: tokens.accessToken }, 'Đổi mật khẩu thành công');
    } catch (error) {
      next(error);
    }
  };
}
