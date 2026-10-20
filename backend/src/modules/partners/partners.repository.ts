import { getPrismaClient } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { ROLE_NAMES } from '../../common/constants/roles';
import { PARTNER_APPLICATION_STATUS } from '../../common/constants/account-status';

export class PartnersRepository {
  async findLatestByAccount(maTaiKhoan: number) {
    const prisma = getPrismaClient();
    return prisma.hO_SO_DOI_TAC.findFirst({
      where: { MaTaiKhoan: maTaiKhoan },
      orderBy: { NgayNop: 'desc' },
    });
  }

  /** Cờ chờ duyệt hoặc bị từ chối suy ra từ hồ sơ gần nhất */
  async getApplicationFlags(maTaiKhoan: number): Promise<{ pending: boolean; rejected: boolean }> {
    const prisma = getPrismaClient();
    const [latest, account] = await Promise.all([
      this.findLatestByAccount(maTaiKhoan),
      prisma.tAI_KHOAN.findUnique({ where: { MaTaiKhoan: maTaiKhoan }, select: { VAI_TRO: { select: { TenVaiTro: true } } } }),
    ]);
    if (!latest || account?.VAI_TRO.TenVaiTro !== ROLE_NAMES.CUSTOMER) return { pending: false, rejected: false };
    return {
      pending: latest.TrangThaiDuyet === PARTNER_APPLICATION_STATUS.PENDING,
      rejected: latest.TrangThaiDuyet === PARTNER_APPLICATION_STATUS.REJECTED,
    };
  }

  async create(data: Prisma.HO_SO_DOI_TACCreateInput) {
    const prisma = getPrismaClient();
    return prisma.hO_SO_DOI_TAC.create({ data });
  }

  async listAdmin(query: { page: number; limit: number; trangThaiDuyet?: string }) {
    const prisma = getPrismaClient();
    const where: Prisma.HO_SO_DOI_TACWhereInput = query.trangThaiDuyet
      ? { TrangThaiDuyet: query.trangThaiDuyet }
      : {};
    const [items, total] = await Promise.all([
      prisma.hO_SO_DOI_TAC.findMany({
        where,
        orderBy: { NgayNop: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          TAI_KHOAN_HO_SO_DOI_TAC_MaTaiKhoanToTAI_KHOAN: { select: { MaTaiKhoan: true, HoTen: true, Email: true } },
          TAI_KHOAN_HO_SO_DOI_TAC_MaTaiKhoanDuyetToTAI_KHOAN: { select: { MaTaiKhoan: true, HoTen: true } },
        },
      }),
      prisma.hO_SO_DOI_TAC.count({ where }),
    ]);
    return { items, total };
  }

  async findByIdAdmin(maHoSoDoiTac: number) {
    const prisma = getPrismaClient();
    return prisma.hO_SO_DOI_TAC.findUnique({
      where: { MaHoSoDoiTac: maHoSoDoiTac },
      include: {
        TAI_KHOAN_HO_SO_DOI_TAC_MaTaiKhoanToTAI_KHOAN: { select: { MaTaiKhoan: true, HoTen: true, Email: true, SoDienThoai: true, MaVaiTro: true } },
        TAI_KHOAN_HO_SO_DOI_TAC_MaTaiKhoanDuyetToTAI_KHOAN: { select: { MaTaiKhoan: true, HoTen: true, Email: true } },
      },
    });
  }

  async runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return getPrismaClient().$transaction(fn);
  }

  async findPendingById(tx: Prisma.TransactionClient, maHoSoDoiTac: number) {
    return tx.hO_SO_DOI_TAC.findUnique({ where: { MaHoSoDoiTac: maHoSoDoiTac } });
  }

  async updatePendingStatus(
    tx: Prisma.TransactionClient,
    maHoSoDoiTac: number,
    adminId: number,
    status: string,
    reason: string | null,
    now: Date
  ) {
    return tx.hO_SO_DOI_TAC.updateMany({
      where: { MaHoSoDoiTac: maHoSoDoiTac, TrangThaiDuyet: 'Chờ duyệt' },
      data: { TrangThaiDuyet: status, MaTaiKhoanDuyet: adminId, NgayDuyet: now, LyDoTuChoi: reason },
    });
  }

  async updateAccountRole(tx: Prisma.TransactionClient, maTaiKhoan: number, maVaiTro: number, now: Date) {
    return tx.tAI_KHOAN.update({ where: { MaTaiKhoan: maTaiKhoan }, data: { MaVaiTro: maVaiTro, NgayCapNhat: now } });
  }
}
