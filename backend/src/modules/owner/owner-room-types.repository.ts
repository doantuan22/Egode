import { getPrismaClient } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { BOOKING_STATUS, ROOM_TYPE_STATUS } from '../../common/constants/hotel-status';

/** Bookings that still have something to happen: waiting for payment, or paid and the stay is not over. */
const OPEN_BOOKING_STATUSES = [BOOKING_STATUS.PENDING_PAYMENT, BOOKING_STATUS.CONFIRMED];

export class OwnerRoomTypesRepository {
  async listForHotel(maKhachSan: number) {
    const prisma = getPrismaClient();
    return prisma.lOAI_PHONG.findMany({
      where: { MaKhachSan: maKhachSan },
      include: { HINH_ANH_LOAI_PHONG: true, LOAI_PHONG_TIEN_NGHI: { include: { TIEN_NGHI: true } } },
      orderBy: { MaLoaiPhong: 'asc' },
    });
  }

  /** Includes the parent KHACH_SAN so the service can verify ownership. */
  async findByIdWithHotel(maLoaiPhong: number) {
    const prisma = getPrismaClient();
    return prisma.lOAI_PHONG.findUnique({
      where: { MaLoaiPhong: maLoaiPhong },
      include: {
        KHACH_SAN: true,
        HINH_ANH_LOAI_PHONG: true,
        LOAI_PHONG_TIEN_NGHI: { include: { TIEN_NGHI: true } },
      },
    });
  }

  async create(maKhachSan: number, data: Omit<Prisma.LOAI_PHONGCreateInput, 'KHACH_SAN'>) {
    const prisma = getPrismaClient();
    return prisma.lOAI_PHONG.create({
      data: { ...data, KHACH_SAN: { connect: { MaKhachSan: maKhachSan } } },
    });
  }

  async update(maLoaiPhong: number, data: Prisma.LOAI_PHONGUpdateInput) {
    const prisma = getPrismaClient();
    return prisma.lOAI_PHONG.update({ where: { MaLoaiPhong: maLoaiPhong }, data });
  }

  /** How many open bookings ("Chờ thanh toán", or "Đã xác nhận" with the stay not over) include this room type. */
  async countOpenBookings(maLoaiPhong: number): Promise<number> {
    const prisma = getPrismaClient();
    return prisma.dAT_PHONG.count({
      where: { TrangThai: { in: OPEN_BOOKING_STATUSES }, CHI_TIET_DAT_PHONG: { some: { MaLoaiPhong: maLoaiPhong } } },
    });
  }

  /**
   * "Hoạt động" → "Ngừng bán" in ONE statement that also requires no open booking of this room type, so a booking
   * that lands between a separate count and the update cannot be left on a room type that was switched off.
   */
  async discontinueWhenNoOpenBookings(maLoaiPhong: number): Promise<boolean> {
    const prisma = getPrismaClient();
    const result = await prisma.lOAI_PHONG.updateMany({
      where: {
        MaLoaiPhong: maLoaiPhong,
        TrangThai: ROOM_TYPE_STATUS.ACTIVE,
        CHI_TIET_DAT_PHONG: { none: { DAT_PHONG: { TrangThai: { in: OPEN_BOOKING_STATUSES } } } },
      },
      data: { TrangThai: ROOM_TYPE_STATUS.DISCONTINUED },
    });
    return result.count === 1;
  }

  async replaceAmenities(maLoaiPhong: number, amenityIds: number[]) {
    const prisma = getPrismaClient();
    await prisma.$transaction([
      prisma.lOAI_PHONG_TIEN_NGHI.deleteMany({ where: { MaLoaiPhong: maLoaiPhong } }),
      ...(amenityIds.length > 0
        ? [
            prisma.lOAI_PHONG_TIEN_NGHI.createMany({
              data: amenityIds.map((MaTienNghi) => ({ MaLoaiPhong: maLoaiPhong, MaTienNghi })),
            }),
          ]
        : []),
    ]);
  }

  async amenitiesExist(amenityIds: number[]): Promise<boolean> {
    if (amenityIds.length === 0) return true;
    const prisma = getPrismaClient();
    const count = await prisma.tIEN_NGHI.count({ where: { MaTienNghi: { in: amenityIds } } });
    return count === new Set(amenityIds).size;
  }

  async addImage(maLoaiPhong: number, url: string, laAnhDaiDien: boolean) {
    const prisma = getPrismaClient();
    return prisma.hINH_ANH_LOAI_PHONG.create({
      data: { MaLoaiPhong: maLoaiPhong, URL: url, LaAnhDaiDien: laAnhDaiDien },
    });
  }

  async findImage(maLoaiPhong: number, maHinhAnh: number) {
    const prisma = getPrismaClient();
    return prisma.hINH_ANH_LOAI_PHONG.findFirst({
      where: { MaHinhAnhLoaiPhong: maHinhAnh, MaLoaiPhong: maLoaiPhong },
    });
  }

  async deleteImage(maHinhAnh: number) {
    const prisma = getPrismaClient();
    await prisma.hINH_ANH_LOAI_PHONG.delete({ where: { MaHinhAnhLoaiPhong: maHinhAnh } });
  }

  async setPrimaryImage(maLoaiPhong: number, maHinhAnh: number) {
    const prisma = getPrismaClient();
    await prisma.$transaction([
      prisma.hINH_ANH_LOAI_PHONG.updateMany({ where: { MaLoaiPhong: maLoaiPhong }, data: { LaAnhDaiDien: false } }),
      prisma.hINH_ANH_LOAI_PHONG.update({ where: { MaHinhAnhLoaiPhong: maHinhAnh }, data: { LaAnhDaiDien: true } }),
    ]);
  }

  async countImages(maLoaiPhong: number): Promise<number> {
    const prisma = getPrismaClient();
    return prisma.hINH_ANH_LOAI_PHONG.count({ where: { MaLoaiPhong: maLoaiPhong } });
  }

  defaultStatus(): string {
    return ROOM_TYPE_STATUS.ACTIVE;
  }
}
