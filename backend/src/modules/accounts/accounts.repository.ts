import { getPrismaClient } from '../../config/prisma';
import { Prisma } from '../../generated/prisma/client';
import type { ListAccountsQuery } from './accounts.schemas';

// Role name travels with the account so clients never have to map MaVaiTro
// (an IDENTITY value that differs between databases) back to a name.
const withRole = { VAI_TRO: { select: { TenVaiTro: true } } } as const;

export class AccountsRepository {
  async list(query: ListAccountsQuery) {
    const prisma = getPrismaClient();
    const where: Prisma.TAI_KHOANWhereInput = {
      ...(query.TrangThai ? { TrangThai: query.TrangThai } : {}),
      ...(query.MaVaiTro ? { MaVaiTro: query.MaVaiTro } : {}),
      ...(query.search
        ? {
            OR: [
              { TenDangNhap: { contains: query.search } },
              { Email: { contains: query.search } },
              { HoTen: { contains: query.search } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.tAI_KHOAN.findMany({
        where,
        include: withRole,
        orderBy: { NgayTao: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.tAI_KHOAN.count({ where }),
    ]);

    return { items, total };
  }

  async findById(maTaiKhoan: number) {
    const prisma = getPrismaClient();
    return prisma.tAI_KHOAN.findUnique({ where: { MaTaiKhoan: maTaiKhoan }, include: withRole });
  }

  async findByEmail(email: string) {
    const prisma = getPrismaClient();
    return prisma.tAI_KHOAN.findUnique({ where: { Email: email } });
  }

  async findByUsername(tenDangNhap: string) {
    const prisma = getPrismaClient();
    return prisma.tAI_KHOAN.findUnique({ where: { TenDangNhap: tenDangNhap } });
  }

  async create(data: Prisma.TAI_KHOANCreateInput) {
    const prisma = getPrismaClient();
    return prisma.tAI_KHOAN.create({ data, include: withRole });
  }

  async runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return getPrismaClient().$transaction(fn);
  }

  /**
   * Locks (U + HOLDLOCK, so the whole key range) every account holding the administrator role until the
   * transaction ends. Two admins acting on administrator accounts at the same moment queue here; whoever
   * comes second then counts the admins that are really left.
   */
  async lockAdministrators(tx: Prisma.TransactionClient, adminRoleId: number): Promise<void> {
    await tx.$queryRaw(Prisma.sql`
      SELECT MaTaiKhoan FROM TAI_KHOAN WITH (UPDLOCK, HOLDLOCK, ROWLOCK) WHERE MaVaiTro = ${adminRoleId}
    `);
  }

  async countActiveAdministratorsExcept(tx: Prisma.TransactionClient, adminRoleId: number, exceptMaTaiKhoan: number, activeStatus: string): Promise<number> {
    return tx.tAI_KHOAN.count({
      where: { MaVaiTro: adminRoleId, TrangThai: activeStatus, MaTaiKhoan: { not: exceptMaTaiKhoan } },
    });
  }

  async findByIdIn(tx: Prisma.TransactionClient, maTaiKhoan: number) {
    return tx.tAI_KHOAN.findUnique({ where: { MaTaiKhoan: maTaiKhoan }, include: withRole });
  }

  async update(maTaiKhoan: number, data: Prisma.TAI_KHOANUpdateInput, db: Prisma.TransactionClient = getPrismaClient()) {
    return db.tAI_KHOAN.update({ where: { MaTaiKhoan: maTaiKhoan }, data, include: withRole });
  }

  async setStatus(maTaiKhoan: number, trangThai: string, db: Prisma.TransactionClient = getPrismaClient()) {
    return db.tAI_KHOAN.update({
      where: { MaTaiKhoan: maTaiKhoan },
      data: { TrangThai: trangThai, NgayCapNhat: new Date() },
      include: withRole,
    });
  }

  /** G0-10: never hard-delete an account that has related history. */
  async hasDependentRecords(maTaiKhoan: number, db: Prisma.TransactionClient = getPrismaClient()): Promise<boolean> {
    const counts = await db.tAI_KHOAN.findUnique({
      where: { MaTaiKhoan: maTaiKhoan },
      select: {
        _count: {
          select: {
            DANH_GIA: true,
            DAT_PHONG: true,
            HO_SO_DOI_TAC_HO_SO_DOI_TAC_MaTaiKhoanToTAI_KHOAN: true,
            HO_SO_DOI_TAC_HO_SO_DOI_TAC_MaTaiKhoanDuyetToTAI_KHOAN: true,
            KHACH_SAN_KHACH_SAN_MaTaiKhoanDuyetToTAI_KHOAN: true,
            KHACH_SAN_KHACH_SAN_MaTaiKhoanSoHuuToTAI_KHOAN: true,
            YEU_CAU_HO_TRO_YEU_CAU_HO_TRO_MaTaiKhoanKhachHangToTAI_KHOAN: true,
            YEU_CAU_HO_TRO_YEU_CAU_HO_TRO_MaTaiKhoanXuLyToTAI_KHOAN: true,
          },
        },
      },
    });

    if (!counts) return false;
    return Object.values(counts._count).some((count) => count > 0);
  }

  async listRoles() {
    const prisma = getPrismaClient();
    return prisma.vAI_TRO.findMany({ select: { MaVaiTro: true, TenVaiTro: true, MoTa: true }, orderBy: { MaVaiTro: 'asc' } });
  }

  async hardDelete(maTaiKhoan: number, db: Prisma.TransactionClient = getPrismaClient()) {
    return db.tAI_KHOAN.delete({ where: { MaTaiKhoan: maTaiKhoan } });
  }
}
