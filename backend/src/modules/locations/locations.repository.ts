import { getPrismaClient } from '../../config/prisma';
import { HOTEL_STATUS } from '../../common/constants/hotel-status';

export class LocationsRepository {
  /** Mọi địa điểm kèm số khách sạn đang niêm yết và một ảnh bìa */
  async findAll() {
    const prisma = getPrismaClient();
    const rows = await prisma.dIA_PHUONG.findMany({
      orderBy: { TenThanhPho: 'asc' },
      include: {
        _count: { select: { KHACH_SAN: { where: { TrangThai: HOTEL_STATUS.ACTIVE } } } },
        KHACH_SAN: {
          where: { TrangThai: HOTEL_STATUS.ACTIVE, HINH_ANH_KHACH_SAN: { some: { AnhDaiDien: true } } },
          orderBy: [{ HangSao: 'desc' }, { MaKhachSan: 'asc' }],
          take: 1,
          select: { HINH_ANH_KHACH_SAN: { where: { AnhDaiDien: true }, take: 1, select: { URL: true } } },
        },
      },
    });
    return rows.map(({ _count, KHACH_SAN, ...location }) => ({
      ...location,
      SoKhachSan: _count.KHACH_SAN,
      AnhDaiDien: KHACH_SAN[0]?.HINH_ANH_KHACH_SAN[0]?.URL ?? null,
    }));
  }
}
