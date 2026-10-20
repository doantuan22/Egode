import { getPrismaClient } from '../../config/prisma';
import { roomTypeInclude } from '../hotels/hotels.repository';
import { HOTEL_STATUS, ROOM_TYPE_STATUS, BOOKING_STATUS } from '../../common/constants/hotel-status';

export class QuotesRepository {
  async findActiveHotel(maKhachSan: number) {
    const prisma = getPrismaClient();
    return prisma.kHACH_SAN.findFirst({ where: { MaKhachSan: maKhachSan, TrangThai: HOTEL_STATUS.ACTIVE } });
  }

  /** Dùng lại dạng giá và tồn kho của endpoint phòng công khai */
  async findRoomTypesByIds(maKhachSan: number, maLoaiPhongList: number[], checkIn: Date, checkOut: Date) {
    const prisma = getPrismaClient();
    return prisma.lOAI_PHONG.findMany({
      where: {
        MaKhachSan: maKhachSan,
        MaLoaiPhong: { in: maLoaiPhongList },
        TrangThai: ROOM_TYPE_STATUS.ACTIVE,
      },
      include: roomTypeInclude(checkIn, checkOut),
    });
  }

  async findPromotionByCode(maCode: string) {
    const prisma = getPrismaClient();
    return prisma.kHUYEN_MAI.findUnique({ where: { MaCode: maCode } });
  }

  /** Số đơn chưa hủy đã dùng mã này */
  async countPromotionUsage(maKhuyenMai: number): Promise<number> {
    const prisma = getPrismaClient();
    return prisma.dAT_PHONG.count({
      where: { MaKhuyenMai: maKhuyenMai, TrangThai: { not: BOOKING_STATUS.CANCELLED } },
    });
  }
}
