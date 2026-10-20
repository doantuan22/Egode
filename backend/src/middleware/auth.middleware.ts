import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../common/utils/jwt';
import { AppError } from '../common/errors/app-error';
import { ROLE_NAMES } from '../common/constants/roles';
import { ACCOUNT_STATUS, PARTNER_APPLICATION_STATUS } from '../common/constants/account-status';
import { getPrismaClient } from '../config/prisma';

export interface AuthenticatedUser {
  maTaiKhoan: number;
  role: string;
  /** Tài khoản có hồ sơ đối tác đang chờ duyệt */
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

/** Xác thực access token và đọc trạng thái tài khoản từ CSDL */
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
    // Trả 401 để client thử refresh rồi kết thúc phiên
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
    // Khách có hồ sơ đối tác đang chờ bị chặn như đối tác
    if (!allowPendingPartner && req.user.pendingPartner && req.user.role === ROLE_NAMES.CUSTOMER) {
      next(AppError.forbidden('Hồ sơ đối tác của bạn đang chờ duyệt. Chức năng này tạm thời bị khóa cho đến khi có kết quả'));
      return;
    }
    next();
  };
};

export const requireRole = (...allowedRoles: string[]) => roleGuard(false, allowedRoles);

/** Giống requireRole nhưng cho phép khách có hồ sơ đối tác đang chờ */
export const requireRoleAllowingPendingPartner = (...allowedRoles: string[]) => roleGuard(true, allowedRoles);

export const requireAdmin = requireRole(ROLE_NAMES.ADMIN);
