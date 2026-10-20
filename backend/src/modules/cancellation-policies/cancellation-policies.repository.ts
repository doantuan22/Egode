import { getPrismaClient } from '../../config/prisma';
import { CANCELLATION_POLICY_STATUS } from '../../common/constants/commercial';

export class CancellationPoliciesRepository {
  async findAllActive() {
    const prisma = getPrismaClient();
    return prisma.cHINH_SACH_HUY.findMany({
      where: { TrangThai: CANCELLATION_POLICY_STATUS.ACTIVE },
      include: { CHI_TIET_CHINH_SACH_HUY: { orderBy: { SoGioTruocNhanPhong: 'desc' } } },
      orderBy: { MaChinhSachHuy: 'asc' },
    });
  }

  async findById(maChinhSachHuy: number) {
    const prisma = getPrismaClient();
    return prisma.cHINH_SACH_HUY.findUnique({
      where: { MaChinhSachHuy: maChinhSachHuy },
      include: { CHI_TIET_CHINH_SACH_HUY: { orderBy: { SoGioTruocNhanPhong: 'desc' } } },
    });
  }

  /** Chính sách hủy hoạt động cũ nhất là mặc định toàn hệ thống */
  async findActiveDefault() {
    const prisma = getPrismaClient();
    return prisma.cHINH_SACH_HUY.findFirst({
      where: { TrangThai: CANCELLATION_POLICY_STATUS.ACTIVE },
      include: { CHI_TIET_CHINH_SACH_HUY: { orderBy: { SoGioTruocNhanPhong: 'desc' } } },
      orderBy: { MaChinhSachHuy: 'asc' },
    });
  }
}
