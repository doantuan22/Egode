import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validateRequest } from '../../middleware/validate.middleware';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from './auth.schemas';
import { authenticate } from '../../middleware/auth.middleware';
import { createRateLimiter } from '../../middleware/security.middleware';
import { requireTrustedOrigin } from '../../middleware/trusted-origin.middleware';

const router = Router();
const controller = new AuthController();
// Giới hạn riêng cho đăng nhập và refresh
const loginLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 10, keyPrefix: 'auth-login' });
const refreshLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 60, keyPrefix: 'auth-refresh' });
const registerLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 10, keyPrefix: 'register' });
const forgotPasswordLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 5, keyPrefix: 'forgot-password' });
// Giới hạn chặt vì nhận token bí mật
const resetPasswordLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 10, keyPrefix: 'reset-password' });
// Giới hạn đoán mật khẩu hiện tại
const changePasswordLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 10, keyPrefix: 'change-password' });
const applyOutsideTests = (middleware: ReturnType<typeof createRateLimiter>) =>
  process.env.NODE_ENV === 'test' ? (_req: unknown, _res: unknown, next: () => void) => next() : middleware;

router.post('/register', applyOutsideTests(registerLimiter), validateRequest({ body: registerSchema }), controller.register);
router.post('/login', applyOutsideTests(loginLimiter), validateRequest({ body: loginSchema }), controller.login);
router.post('/refresh', requireTrustedOrigin, applyOutsideTests(refreshLimiter), controller.refresh);
router.post('/logout', requireTrustedOrigin, controller.logout);
router.post(
  '/forgot-password',
  applyOutsideTests(forgotPasswordLimiter),
  validateRequest({ body: forgotPasswordSchema }),
  controller.forgotPassword
);
router.post(
  '/reset-password',
  applyOutsideTests(resetPasswordLimiter),
  validateRequest({ body: resetPasswordSchema }),
  controller.resetPassword
);
router.post(
  '/change-password',
  applyOutsideTests(changePasswordLimiter),
  authenticate,
  validateRequest({ body: changePasswordSchema }),
  controller.changePassword
);

export default router;
