import { getPrismaClient } from '../../config/prisma';
import type { AdminBookingsQuery } from './admin-bookings.schemas';

const listInclude = {
  TAI_KHOAN: { select: { MaTaiKhoan: true, HoTen: true, SoDienThoai: true } },
  KHACH_SAN: { select: { MaKhachSan: true, TenKhachSan: true } },
  CHI_TIET_DAT_PHONG: { select: { SoLuongPhong: true } },
} as const;

const detailInclude = {
  TAI_KHOAN: { select: { MaTaiKhoan: true, HoTen: true, SoDienThoai: true } },
  KHACH_SAN: {
    select: {
      MaKhachSan: true,
      TenKhachSan: true,
      DiaChiChiTiet: true,
      GioNhanPhong: true,
      GioTraPhong: true,
    },
  },
  CHI_TIET_DAT_PHONG: {
    include: { LOAI_PHONG: { select: { MaLoaiPhong: true, TenLoaiPhong: true } } },
  },
  THANH_TOAN: {
    select: {
      MaThanhToan: true,
      SoTien: true,
      PhuongThucThanhToan: true,
      MaGiaoDichDoiTac: true,
      TrangThai: true,
      ThoiGianGiaoDich: true,
      HOAN_TIEN: {
        select: {
          MaHoanTien: true,
          SoTienHoan: true,
          LyDoHoanTien: true,
          TrangThai: true,
          NgayYeuCau: true,
          NgayHoanTien: true,
        },
      },
    },
  },
  KHUYEN_MAI: { select: { MaKhuyenMai: true, MaCode: true, LoaiGiamGia: true, GiaTriGiam: true } },
  CHINH_SACH_HUY: {
    select: {
      MaChinhSachHuy: true,
      TenChinhSach: true,
      MoTa: true,
      CHI_TIET_CHINH_SACH_HUY: {
        select: { SoGioTruocNhanPhong: true, TyLeHoanTien: true },
        orderBy: { SoGioTruocNhanPhong: 'desc' as const },
      },
    },
  },
} as const;

export class AdminBookingsRepository {
  async list(query: AdminBookingsQuery) {
    const prisma = getPrismaClient();
    const where = {
      ...(query.trangThai ? { TrangThai: query.trangThai } : {}),
      ...(query.hotelId ? { MaKhachSan: query.hotelId } : {}),
      ...(query.search ? {
        OR: [
          { MaXacNhanDatPhong: { contains: query.search } },
          { TAI_KHOAN: { HoTen: { contains: query.search } } },
          { KHACH_SAN: { TenKhachSan: { contains: query.search } } },
        ],
      } : {}),
      ...((query.from || query.to) ? {
        NgayNhanPhong: {
          ...(query.from ? { gte: query.from } : {}),
          ...(query.to ? { lte: query.to } : {}),
        },
      } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.dAT_PHONG.findMany({
        where,
        include: listInclude,
        orderBy: { NgayTao: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.dAT_PHONG.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: number) {
    return getPrismaClient().dAT_PHONG.findUnique({
      where: { MaDatPhong: id },
      include: detailInclude,
    });
  }
}
