import { getPrismaClient } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import type { AdminListSupportQuery } from './support.schemas';

// Đọc và cập nhật trả về cùng các quan hệ
const supportDetailInclude = {
  DAT_PHONG: { select: { MaDatPhong: true, MaXacNhanDatPhong: true } },
  TAI_KHOAN_YEU_CAU_HO_TRO_MaTaiKhoanKhachHangToTAI_KHOAN: { select: { MaTaiKhoan: true, HoTen: true, Email: true } },
  TAI_KHOAN_YEU_CAU_HO_TRO_MaTaiKhoanXuLyToTAI_KHOAN: { select: { MaTaiKhoan: true, HoTen: true } },
} satisfies Prisma.YEU_CAU_HO_TROInclude;

export interface CreateSupportData {
  maTaiKhoanKhachHang: number;
  maDatPhong: number | null;
  loaiYeuCau: string;
  tieuDe: string;
  noiDung: string;
  trangThai: string;
  ngayTao: Date;
}

export interface UpdateSupportData {
  trangThai: string;
  ketQuaXuLy?: string;
  maTaiKhoanXuLy: number;
  ngayXuLy?: Date;
}

export class SupportRepository {
  async findBookingOwner(maDatPhong: number) {
    const prisma = getPrismaClient();
    return prisma.dAT_PHONG.findUnique({ where: { MaDatPhong: maDatPhong }, select: { MaDatPhong: true, MaTaiKhoanKhachHang: true } });
  }

  async create(data: CreateSupportData) {
    const prisma = getPrismaClient();
    return prisma.yEU_CAU_HO_TRO.create({
      data: {
        TAI_KHOAN_YEU_CAU_HO_TRO_MaTaiKhoanKhachHangToTAI_KHOAN: { connect: { MaTaiKhoan: data.maTaiKhoanKhachHang } },
        ...(data.maDatPhong ? { DAT_PHONG: { connect: { MaDatPhong: data.maDatPhong } } } : {}),
        LoaiYeuCau: data.loaiYeuCau,
        TieuDe: data.tieuDe,
        NoiDung: data.noiDung,
        TrangThai: data.trangThai,
        NgayTao: data.ngayTao,
      },
    });
  }

  async listByCustomer(maTaiKhoanKhachHang: number) {
    const prisma = getPrismaClient();
    return prisma.yEU_CAU_HO_TRO.findMany({
      where: { MaTaiKhoanKhachHang: maTaiKhoanKhachHang },
      orderBy: { NgayTao: 'desc' },
      include: { DAT_PHONG: { select: { MaDatPhong: true, MaXacNhanDatPhong: true } } },
    });
  }

  async findById(maYeuCauHoTro: number) {
    const prisma = getPrismaClient();
    return prisma.yEU_CAU_HO_TRO.findUnique({
      where: { MaYeuCauHoTro: maYeuCauHoTro },
      include: supportDetailInclude,
    });
  }

  async listAdmin(query: AdminListSupportQuery) {
    const prisma = getPrismaClient();
    const where: Prisma.YEU_CAU_HO_TROWhereInput = {
      ...(query.trangThai ? { TrangThai: query.trangThai } : {}),
      ...(query.loaiYeuCau ? { LoaiYeuCau: query.loaiYeuCau } : {}),
      ...(query.search
        ? {
            OR: [
              { TieuDe: { contains: query.search } },
              { NoiDung: { contains: query.search } },
              { TAI_KHOAN_YEU_CAU_HO_TRO_MaTaiKhoanKhachHangToTAI_KHOAN: { HoTen: { contains: query.search } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.yEU_CAU_HO_TRO.findMany({
        where,
        orderBy: { NgayTao: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          DAT_PHONG: { select: { MaDatPhong: true, MaXacNhanDatPhong: true } },
          TAI_KHOAN_YEU_CAU_HO_TRO_MaTaiKhoanKhachHangToTAI_KHOAN: { select: { MaTaiKhoan: true, HoTen: true, Email: true } },
        },
      }),
      prisma.yEU_CAU_HO_TRO.count({ where }),
    ]);

    return { items, total };
  }

  async update(maYeuCauHoTro: number, data: UpdateSupportData) {
    const prisma = getPrismaClient();
    return prisma.yEU_CAU_HO_TRO.update({
      where: { MaYeuCauHoTro: maYeuCauHoTro },
      data: {
        TrangThai: data.trangThai,
        ...(data.ketQuaXuLy !== undefined ? { KetQuaXuLy: data.ketQuaXuLy } : {}),
        TAI_KHOAN_YEU_CAU_HO_TRO_MaTaiKhoanXuLyToTAI_KHOAN: { connect: { MaTaiKhoan: data.maTaiKhoanXuLy } },
        ...(data.ngayXuLy ? { NgayXuLy: data.ngayXuLy } : {}),
      },
      include: supportDetailInclude,
    });
  }
}
