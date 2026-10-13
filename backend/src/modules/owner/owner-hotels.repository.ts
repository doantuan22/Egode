import { getPrismaClient } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { BOOKING_STATUS, HOTEL_STATUS } from '../../common/constants/hotel-status';

/** Bookings that still have something to happen: waiting for payment, or paid and the stay is not over. */
const OPEN_BOOKING_STATUSES = [BOOKING_STATUS.PENDING_PAYMENT, BOOKING_STATUS.CONFIRMED];

export class OwnerHotelsRepository {
  async listByOwner(ownerId: number) {
    const prisma = getPrismaClient();
    return prisma.kHACH_SAN.findMany({
      where: { MaTaiKhoanSoHuu: ownerId },
      include: { DIA_PHUONG: true, HINH_ANH_KHACH_SAN: true, _count: { select: { LOAI_PHONG: true } } },
      orderBy: { NgayDangKy: 'desc' },
    });
  }

  async findById(maKhachSan: number) {
    const prisma = getPrismaClient();
    return prisma.kHACH_SAN.findUnique({
      where: { MaKhachSan: maKhachSan },
      include: {
        DIA_PHUONG: true,
        HINH_ANH_KHACH_SAN: true,
        KHACH_SAN_TIEN_NGHI: { include: { TIEN_NGHI: true } },
      },
    });
  }

  async diaPhuongExists(maDiaPhuong: number): Promise<boolean> {
    const prisma = getPrismaClient();
    const count = await prisma.dIA_PHUONG.count({ where: { MaDiaPhuong: maDiaPhuong } });
    return count > 0;
  }

  async create(ownerId: number, data: Omit<Prisma.KHACH_SANCreateInput, 'TAI_KHOAN_KHACH_SAN_MaTaiKhoanSoHuuToTAI_KHOAN' | 'DIA_PHUONG'> & { MaDiaPhuong: number }) {
    const prisma = getPrismaClient();
    const { MaDiaPhuong, ...rest } = data;
    return prisma.kHACH_SAN.create({
      data: {
        ...rest,
        TAI_KHOAN_KHACH_SAN_MaTaiKhoanSoHuuToTAI_KHOAN: { connect: { MaTaiKhoan: ownerId } },
        DIA_PHUONG: { connect: { MaDiaPhuong } },
      },
    });
  }

  async update(maKhachSan: number, data: Prisma.KHACH_SANUpdateInput) {
    const prisma = getPrismaClient();
    return prisma.kHACH_SAN.update({ where: { MaKhachSan: maKhachSan }, data });
  }

  /** Atomic compare-and-set on TrangThai; false when the hotel is no longer in the expected state. */
  async changeStatus(maKhachSan: number, from: string, to: string, now: Date): Promise<boolean> {
    const prisma = getPrismaClient();
    const result = await prisma.kHACH_SAN.updateMany({
      where: { MaKhachSan: maKhachSan, TrangThai: from },
      data: { TrangThai: to, NgayCapNhat: now },
    });
    return result.count === 1;
  }

  /** How many of this hotel's bookings are still open ("Chờ thanh toán" or "Đã xác nhận", stay not finished). */
  async countOpenBookings(maKhachSan: number): Promise<number> {
    const prisma = getPrismaClient();
    return prisma.dAT_PHONG.count({ where: { MaKhachSan: maKhachSan, TrangThai: { in: OPEN_BOOKING_STATUSES } } });
  }

  /**
   * Hoạt động → Ngừng hoạt động in ONE statement that also requires no open booking, so a booking that lands
   * between a separate count and the update cannot be left on a hotel that was switched off. False when the
   * hotel is no longer active or has an open booking.
   */
  async deactivateWhenNoOpenBookings(maKhachSan: number, now: Date): Promise<boolean> {
    const prisma = getPrismaClient();
    const result = await prisma.kHACH_SAN.updateMany({
      where: {
        MaKhachSan: maKhachSan,
        TrangThai: HOTEL_STATUS.ACTIVE,
        DAT_PHONG: { none: { TrangThai: { in: OPEN_BOOKING_STATUSES } } },
      },
      data: { TrangThai: HOTEL_STATUS.INACTIVE, NgayCapNhat: now },
    });
    return result.count === 1;
  }

  async replaceAmenities(maKhachSan: number, amenityIds: number[]) {
    const prisma = getPrismaClient();
    await prisma.$transaction([
      prisma.kHACH_SAN_TIEN_NGHI.deleteMany({ where: { MaKhachSan: maKhachSan } }),
      ...(amenityIds.length > 0
        ? [
            prisma.kHACH_SAN_TIEN_NGHI.createMany({
              data: amenityIds.map((MaTienNghi) => ({ MaKhachSan: maKhachSan, MaTienNghi })),
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

  async addImage(maKhachSan: number, url: string, anhDaiDien: boolean) {
    const prisma = getPrismaClient();
    return prisma.hINH_ANH_KHACH_SAN.create({ data: { MaKhachSan: maKhachSan, URL: url, AnhDaiDien: anhDaiDien } });
  }

  async findImage(maKhachSan: number, maHinhAnh: number) {
    const prisma = getPrismaClient();
    return prisma.hINH_ANH_KHACH_SAN.findFirst({ where: { MaHinhAnh: maHinhAnh, MaKhachSan: maKhachSan } });
  }

  async deleteImage(maHinhAnh: number) {
    const prisma = getPrismaClient();
    await prisma.hINH_ANH_KHACH_SAN.delete({ where: { MaHinhAnh: maHinhAnh } });
  }

  async setPrimaryImage(maKhachSan: number, maHinhAnh: number) {
    const prisma = getPrismaClient();
    await prisma.$transaction([
      prisma.hINH_ANH_KHACH_SAN.updateMany({ where: { MaKhachSan: maKhachSan }, data: { AnhDaiDien: false } }),
      prisma.hINH_ANH_KHACH_SAN.update({ where: { MaHinhAnh: maHinhAnh }, data: { AnhDaiDien: true } }),
    ]);
  }

  async countImages(maKhachSan: number): Promise<number> {
    const prisma = getPrismaClient();
    return prisma.hINH_ANH_KHACH_SAN.count({ where: { MaKhachSan: maKhachSan } });
  }

  hotelStatusDefault(): string {
    return HOTEL_STATUS.PENDING_APPROVAL;
  }
}
