import { Request, Response, NextFunction } from 'express';
import { AccountsService } from './accounts.service';
import { sendSuccess, sendPaginated } from '../../common/utils/response';

export class AccountsController {
  constructor(private readonly accountsService: AccountsService = new AccountsService()) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { items, pagination } = await this.accountsService.list(
        req.query as unknown as Parameters<AccountsService['list']>[0]
      );
      sendPaginated(res, items, pagination);
    } catch (error) {
      next(error);
    }
  };

  listRoles = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.accountsService.listRoles());
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const account = await this.accountsService.getById(id);
      sendSuccess(res, account);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = await this.accountsService.create(req.body);
      sendSuccess(res, account, 'Tạo tài khoản thành công', 201);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const account = await this.accountsService.update(id, req.user!.maTaiKhoan, req.body);
      sendSuccess(res, account, 'Cập nhật tài khoản thành công');
    } catch (error) {
      next(error);
    }
  };

  lock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const account = await this.accountsService.lock(id, req.user!.maTaiKhoan);
      sendSuccess(res, account, 'Đã khóa tài khoản');
    } catch (error) {
      next(error);
    }
  };

  unlock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const account = await this.accountsService.unlock(id);
      sendSuccess(res, account, 'Đã mở khóa tài khoản');
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const result = await this.accountsService.safeDelete(id, req.user!.maTaiKhoan);
      sendSuccess(
        res,
        result,
        result.hardDeleted
          ? 'Đã xóa tài khoản'
          : 'Tài khoản có dữ liệu lịch sử liên quan nên đã được khóa thay vì xóa'
      );
    } catch (error) {
      next(error);
    }
  };
}
