import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../common/utils/jwt';
import { AppError } from '../common/errors/app-error';
import { ROLE_NAMES } from '../common/constants/roles';
import { ACCOUNT_STATUS, PARTNER_APPLICATION_STATUS } from '../common/constants/account-status';
import { getPrismaClient } from '../config/prisma';

export interface AuthenticatedUser {
  maTaiKhoan: number;
  role: string;
  /** True while the account has a partner application awaiting review: it is then held to the same limits as a partner. */
  pendingPartner: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const extractBearerToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
};

/**
 * The access token only proves who the caller is (signature + expiry). What the caller may do is read from
 * the database on every request: a locked account loses API access at once, and the role is the account's
 * CURRENT role, not the one that happened to be in the token when it was issued.
 */
export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const token = extractBearerToken(req);
  if (!token) {
    next(AppError.unauthorized('Missing or invalid Authorization header'));
    return;
  }

  let accountId: number;
  try {
    accountId = Number(verifyAccessToken(token).sub);
  } catch {
    next(AppError.unauthorized('Invalid or expired access token'));
    return;
  }

  try {
    const account = await getPrismaClient().tAI_KHOAN.findUnique({
      where: { MaTaiKhoan: accountId },
      select: {
        TrangThai: true,
        VAI_TRO: { select: { TenVaiTro: true } },
        HO_SO_DOI_TAC_HO_SO_DOI_TAC_MaTaiKhoanToTAI_KHOAN: {
          where: { TrangThaiDuyet: PARTNER_APPLICATION_STATUS.PENDING },
          select: { MaHoSoDoiTac: true },
          take: 1,
        },
      },
    });
    // 401 (not 403): the client then tries to refresh, the refresh is refused for a locked account, and the
    // session ends instead of the user being left "signed in" to a dead account.
    if (!account || account.TrangThai === ACCOUNT_STATUS.LOCKED) {
      next(AppError.unauthorized('Tài khoản không khả dụng'));
      return;
    }
    req.user = {
      maTaiKhoan: accountId,
      role: account.VAI_TRO.TenVaiTro,
      pendingPartner: account.HO_SO_DOI_TAC_HO_SO_DOI_TAC_MaTaiKhoanToTAI_KHOAN.length > 0,
    };
    next();
  } catch (error) {
    next(error);
  }
};

const roleGuard = (allowPendingPartner: boolean, allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized('Authentication required'));
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      next(AppError.forbidden('You do not have permission to perform this action'));
      return;
    }
    // A customer whose partner application is pending is locked out of customer-only features, exactly as
    // a partner is (those routes answer 403 to the partner role). Nothing is stored: the pending row is the signal.
    if (!allowPendingPartner && req.user.pendingPartner && req.user.role === ROLE_NAMES.CUSTOMER) {
      next(AppError.forbidden('Hồ sơ đối tác của bạn đang chờ duyệt. Chức năng này tạm thời bị khóa cho đến khi có kết quả'));
      return;
    }
    next();
  };
};

export const requireRole = (...allowedRoles: string[]) => roleGuard(false, allowedRoles);

/** Like requireRole but a customer with a pending partner application still passes (only the application flow itself). */
export const requireRoleAllowingPendingPartner = (...allowedRoles: string[]) => roleGuard(true, allowedRoles);

export const requireAdmin = requireRole(ROLE_NAMES.ADMIN);
