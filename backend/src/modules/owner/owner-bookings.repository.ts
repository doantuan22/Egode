import { getPrismaClient } from '../../config/prisma';
import type { OwnerBookingsQuery } from './owner-bookings.schemas';

// Chỉ lộ số điện thoại và ghi chú của khách
const bookingInclude = {
  TAI_KHOAN: { select: { MaTaiKhoan: true, HoTen: true, SoDienThoai: true } },
  KHACH_SAN: { select: { GioNhanPhong: true, GioTraPhong: true } },
  CHI_TIET_DAT_PHONG: { include: { LOAI_PHONG: { select: { MaLoaiPhong: true, TenLoaiPhong: true } } } },
  THANH_TOAN: { select: { MaThanhToan: true, TrangThai: true, PhuongThucThanhToan: true, SoTien: true, ThoiGianGiaoDich: true } },
} as const;

export class OwnerBookingsRepository {
  async listForHotel(hotelId: number, query: OwnerBookingsQuery) {
    const prisma = getPrismaClient();
    const where = {
      MaKhachSan: hotelId,
      ...(query.trangThai ? { TrangThai: query.trangThai } : {}),
      ...(query.search ? { OR: [{ MaXacNhanDatPhong: { contains: query.search } }, { TAI_KHOAN: { HoTen: { contains: query.search } } }] } : {}),
      ...((query.from || query.to) ? { NgayNhanPhong: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.dAT_PHONG.findMany({ where, include: bookingInclude, orderBy: { NgayTao: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }),
      prisma.dAT_PHONG.count({ where }),
    ]);
    return { items, total };
  }

  async findForHotel(hotelId: number, bookingId: number) {
    const prisma = getPrismaClient();
    return prisma.dAT_PHONG.findFirst({ where: { MaDatPhong: bookingId, MaKhachSan: hotelId }, include: bookingInclude });
  }
}
