import { getPrismaClient } from '../../config/prisma';
import { HOTEL_STATUS, ROOM_TYPE_STATUS, ROOM_RATE_STATUS, BOOKING_STATUS } from '../../common/constants/hotel-status';

export interface CandidateHotelParams {
  location?: string;
  starRating?: number;
  amenityIds?: number[];
  checkIn: Date;
  checkOut: Date;
}

/** Exported so other modules (e.g. quotes) can fetch room types with the
 * exact same price/availability shape without duplicating this query. */
export const roomTypeInclude = (checkIn: Date, checkOut: Date) => ({
  QUY_PHONG_GIA: {
    where: {
      NgayApDung: { gte: checkIn, lt: checkOut },
      TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE,
    },
  },
  HINH_ANH_LOAI_PHONG: true,
  LOAI_PHONG_TIEN_NGHI: { include: { TIEN_NGHI: true } },
  CHI_TIET_DAT_PHONG: {
    where: {
      DAT_PHONG: {
        TrangThai: { not: BOOKING_STATUS.CANCELLED },
        NgayNhanPhong: { lt: checkOut },
        NgayTraPhong: { gt: checkIn },
      },
    },
    include: {
      DAT_PHONG: { select: { NgayNhanPhong: true, NgayTraPhong: true } },
    },
  },
});

export class HotelsRepository {
  /** Candidate hotels for search — full nested price/availability data for the requested range. */
  async findCandidateHotels(params: CandidateHotelParams) {
    const prisma = getPrismaClient();
    return prisma.kHACH_SAN.findMany({
      where: {
        TrangThai: HOTEL_STATUS.ACTIVE,
        ...(params.starRating ? { HangSao: { gte: params.starRating } } : {}),
        ...(params.location
          ? {
              DIA_PHUONG: {
                OR: [
                  { TenThanhPho: { contains: params.location } },
                  { TenTinh: { contains: params.location } },
                ],
              },
            }
          : {}),
        ...(params.amenityIds && params.amenityIds.length > 0
          ? {
              AND: params.amenityIds.map((maTienNghi) => ({
                KHACH_SAN_TIEN_NGHI: { some: { MaTienNghi: maTienNghi } },
              })),
            }
          : {}),
        LOAI_PHONG: { some: { TrangThai: ROOM_TYPE_STATUS.ACTIVE } },
      },
      include: {
        DIA_PHUONG: true,
        HINH_ANH_KHACH_SAN: true,
        LOAI_PHONG: {
          where: { TrangThai: ROOM_TYPE_STATUS.ACTIVE },
          include: roomTypeInclude(params.checkIn, params.checkOut),
        },
      },
    });
  }

  async findActiveHotelById(maKhachSan: number) {
    const prisma = getPrismaClient();
    return prisma.kHACH_SAN.findFirst({
      where: { MaKhachSan: maKhachSan, TrangThai: HOTEL_STATUS.ACTIVE },
      include: {
        DIA_PHUONG: true,
        HINH_ANH_KHACH_SAN: true,
        KHACH_SAN_TIEN_NGHI: { include: { TIEN_NGHI: true } },
      },
    });
  }

  async hotelExists(maKhachSan: number): Promise<boolean> {
    const prisma = getPrismaClient();
    const count = await prisma.kHACH_SAN.count({
      where: { MaKhachSan: maKhachSan, TrangThai: HOTEL_STATUS.ACTIVE },
    });
    return count > 0;
  }

  async findRoomTypesForHotel(
    maKhachSan: number,
    checkIn: Date,
    checkOut: Date
  ) {
    const prisma = getPrismaClient();
    return prisma.lOAI_PHONG.findMany({
      where: {
        MaKhachSan: maKhachSan,
        TrangThai: ROOM_TYPE_STATUS.ACTIVE,
      },
      include: roomTypeInclude(checkIn, checkOut),
      orderBy: { MaLoaiPhong: 'asc' },
    });
  }
}
