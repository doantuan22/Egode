import { AccountsRepository } from './accounts.repository';
import { RolesRepository } from '../roles/roles.repository';
import { AppError } from '../../common/errors/app-error';
import { hashPassword } from '../../common/utils/password';
import { toSafeAccount, SafeAccount } from '../../common/utils/account-mapper';
import { ACCOUNT_STATUS } from '../../common/constants/account-status';
import { ROLE_NAMES } from '../../common/constants/roles';
import type { Prisma } from '../../generated/prisma/client';
import type { ApiPaginationMeta } from '../../common/types/api-response';
import type { CreateAccountInput, ListAccountsQuery, UpdateAccountInput } from './accounts.schemas';

export interface PaginatedAccounts {
  items: SafeAccount[];
  pagination: ApiPaginationMeta;
}

export class AccountsService {
  constructor(
    private readonly accountsRepository: AccountsRepository = new AccountsRepository(),
    private readonly rolesRepository: RolesRepository = new RolesRepository()
  ) {}

  async list(query: ListAccountsQuery): Promise<PaginatedAccounts> {
    const { items, total } = await this.accountsRepository.list(query);
    return {
      items: items.map(toSafeAccount),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getById(maTaiKhoan: number): Promise<SafeAccount> {
    const account = await this.accountsRepository.findById(maTaiKhoan);
    if (!account) throw AppError.notFound('Tài khoản không tồn tại');
    return toSafeAccount(account);
  }

  async listRoles() {
    return this.accountsRepository.listRoles();
  }

  async create(input: CreateAccountInput): Promise<SafeAccount> {
    const [existingEmail, existingUsername, role] = await Promise.all([
      this.accountsRepository.findByEmail(input.Email),
      this.accountsRepository.findByUsername(input.TenDangNhap),
      this.rolesRepository.findById(input.MaVaiTro),
    ]);
    if (existingEmail) throw AppError.conflict('Email đã được sử dụng', [{ field: 'Email', message: 'Email đã được sử dụng' }]);
    if (existingUsername) throw AppError.conflict('Tên đăng nhập đã được sử dụng', [{ field: 'TenDangNhap', message: 'Tên đăng nhập đã được sử dụng' }]);
    if (!role) throw AppError.badRequest('Vai trò không tồn tại');

    const matKhauHash = await hashPassword(input.MatKhau);
    const now = new Date();
    const account = await this.accountsRepository.create({
      TenDangNhap: input.TenDangNhap,
      Email: input.Email,
      MatKhau: matKhauHash,
      HoTen: input.HoTen,
      SoDienThoai: input.SoDienThoai,
      NgaySinh: input.NgaySinh ?? null,
      GioiTinh: input.GioiTinh ?? null,
      AnhDaiDien: null,
      TrangThai: ACCOUNT_STATUS.ACTIVE,
      NgayTao: now,
      NgayCapNhat: now,
      VAI_TRO: { connect: { MaVaiTro: role.MaVaiTro } },
    });
    return toSafeAccount(account);
  }

  /** Đảm bảo luôn còn ít nhất một admin hoạt động */
  private async assertAdminCanBeReduced(
    tx: Prisma.TransactionClient,
    actorId: number,
    targetId: number,
    action: 'lock' | 'delete' | 'demote'
  ): Promise<void> {
    const verb = { lock: 'khóa', delete: 'xóa', demote: 'hạ quyền' }[action];
    if (actorId === targetId) {
      throw AppError.badRequest(`Bạn không thể tự ${verb} tài khoản của chính mình`);
    }
    const adminRole = await this.rolesRepository.findByName(ROLE_NAMES.ADMIN);
    if (!adminRole) return;
    await this.accountsRepository.lockAdministrators(tx, adminRole.MaVaiTro);
    const target = await this.accountsRepository.findByIdIn(tx, targetId);
    if (!target) throw AppError.notFound('Tài khoản không tồn tại');
    if (target.MaVaiTro !== adminRole.MaVaiTro || target.TrangThai !== ACCOUNT_STATUS.ACTIVE) return;
    const others = await this.accountsRepository.countActiveAdministratorsExcept(tx, adminRole.MaVaiTro, targetId, ACCOUNT_STATUS.ACTIVE);
    if (others === 0) {
      throw AppError.conflict(`Không thể ${verb} quản trị viên cuối cùng — hệ thống phải còn ít nhất một quản trị viên đang hoạt động`);
    }
  }

  async update(maTaiKhoan: number, actorId: number, input: UpdateAccountInput): Promise<SafeAccount> {
    const existing = await this.accountsRepository.findById(maTaiKhoan);
    if (!existing) throw AppError.notFound('Tài khoản không tồn tại');

    if (input.Email && input.Email !== existing.Email) {
      const dup = await this.accountsRepository.findByEmail(input.Email);
      if (dup) throw AppError.conflict('Email đã được sử dụng', [{ field: 'Email', message: 'Email đã được sử dụng' }]);
    }
    if (input.TenDangNhap && input.TenDangNhap !== existing.TenDangNhap) {
      const dup = await this.accountsRepository.findByUsername(input.TenDangNhap);
      if (dup) throw AppError.conflict('Tên đăng nhập đã được sử dụng', [{ field: 'TenDangNhap', message: 'Tên đăng nhập đã được sử dụng' }]);
    }
    if (input.MaVaiTro !== undefined) {
      const role = await this.rolesRepository.findById(input.MaVaiTro);
      if (!role) throw AppError.badRequest('Vai trò không tồn tại');
    }

    const changesRole = input.MaVaiTro !== undefined && input.MaVaiTro !== existing.MaVaiTro;
    const data = { ...input, NgayCapNhat: new Date() };
    if (!changesRole) {
      return toSafeAccount(await this.accountsRepository.update(maTaiKhoan, data));
    }

    // Đổi vai trò có thể làm mất quyền admin nên cần kiểm tra
    const updated = await this.accountsRepository.runInTransaction(async (tx) => {
      await this.assertAdminCanBeReduced(tx, actorId, maTaiKhoan, 'demote');
      return this.accountsRepository.update(maTaiKhoan, data, tx);
    });
    return toSafeAccount(updated);
  }

  async lock(maTaiKhoan: number, actorId: number): Promise<SafeAccount> {
    const existing = await this.accountsRepository.findById(maTaiKhoan);
    if (!existing) throw AppError.notFound('Tài khoản không tồn tại');
    const updated = await this.accountsRepository.runInTransaction(async (tx) => {
      await this.assertAdminCanBeReduced(tx, actorId, maTaiKhoan, 'lock');
      return this.accountsRepository.setStatus(maTaiKhoan, ACCOUNT_STATUS.LOCKED, tx);
    });
    return toSafeAccount(updated);
  }

  async unlock(maTaiKhoan: number): Promise<SafeAccount> {
    const existing = await this.accountsRepository.findById(maTaiKhoan);
    if (!existing) throw AppError.notFound('Tài khoản không tồn tại');
    const updated = await this.accountsRepository.setStatus(maTaiKhoan, ACCOUNT_STATUS.ACTIVE);
    return toSafeAccount(updated);
  }

  /** Chỉ xóa cứng khi chưa có lịch sử liên quan, nếu không thì khóa tài khoản */
  async safeDelete(maTaiKhoan: number, actorId: number): Promise<{ hardDeleted: boolean }> {
    const existing = await this.accountsRepository.findById(maTaiKhoan);
    if (!existing) throw AppError.notFound('Tài khoản không tồn tại');

    return this.accountsRepository.runInTransaction(async (tx) => {
      // Xóa hoặc khóa tài khoản làm giảm số admin hoạt động
      await this.assertAdminCanBeReduced(tx, actorId, maTaiKhoan, 'delete');

      const hasHistory = await this.accountsRepository.hasDependentRecords(maTaiKhoan, tx);
      if (hasHistory) {
        await this.accountsRepository.setStatus(maTaiKhoan, ACCOUNT_STATUS.LOCKED, tx);
        return { hardDeleted: false };
      }

      await this.accountsRepository.hardDelete(maTaiKhoan, tx);
      return { hardDeleted: true };
    });
  }
}
