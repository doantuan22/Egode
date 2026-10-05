import { getPrismaClient } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import type { AdminListReviewsQuery } from './reviews.schemas';
import { REVIEW_STATUS } from '../../common/constants/review';
import { HOTEL_STATUS } from '../../common/constants/hotel-status';

// Moderation responses replace the cached admin detail, so retain all relations.
const adminReviewDetailInclude = {
  HINH_ANH_DANH_GIA: true,
  TAI_KHOAN: { select: { MaTaiKhoan: true, HoTen: true, Email: true } },
  KHACH_SAN: { select: { MaKhachSan: true, TenKhachSan: true } },
  DAT_PHONG: { select: { MaDatPhong: true, MaXacNhanDatPhong: true, NgayNhanPhong: true, NgayTraPhong: true } },
} satisfies Prisma.DANH_GIAInclude;

export interface CreateReviewData {
  maDatPhong: number;
  maKhachHang: number;
  maKhachSan: number;
  diemDanhGia: number;
  noiDung: string | null;
  trangThai: string;
}

export interface RatingSummary {
  DiemTrungBinh: number | null;
  SoLuongDanhGia: number;
}

export class ReviewsRepository {
  /** Only "Hiển thị" reviews are public; every other status (Chờ duyệt, Ẩn, Vi phạm) is invisible and uncounted. */
  async listPublicByHotel(maKhachSan: number, page: number, limit: number) {
    const prisma = getPrismaClient();
    const where = { MaKhachSan: maKhachSan, TrangThai: REVIEW_STATUS.VISIBLE };
    const [items, total] = await Promise.all([
      prisma.dANH_GIA.findMany({
        where,
        orderBy: { MaDanhGia: 'desc' }, // DANH_GIA has no date column; ids grow with time
        skip: (page - 1) * limit,
        take: limit,
        select: {
          MaDanhGia: true,
          DiemDanhGia: true,
          NoiDung: true,
          HINH_ANH_DANH_GIA: { select: { URL: true }, orderBy: { MaHinhAnhDanhGia: 'asc' } },
          TAI_KHOAN: { select: { HoTen: true } },
        },
      }),
      prisma.dANH_GIA.count({ where }),
    ]);
    return { items, total };
  }

  /** Average score and count of the visible reviews, for several hotels in one query. */
  async ratingSummaries(maKhachSanList: number[]): Promise<Map<number, RatingSummary>> {
    const summaries = new Map<number, RatingSummary>();
    if (maKhachSanList.length === 0) return summaries;
    const prisma = getPrismaClient();
    const rows = await prisma.dANH_GIA.groupBy({
      by: ['MaKhachSan'],
      where: { MaKhachSan: { in: maKhachSanList }, TrangThai: REVIEW_STATUS.VISIBLE },
      _avg: { DiemDanhGia: true },
      _count: { _all: true },
    });
    for (const row of rows) {
      summaries.set(row.MaKhachSan, {
        DiemTrungBinh: row._avg.DiemDanhGia === null ? null : Math.round(row._avg.DiemDanhGia * 10) / 10,
        SoLuongDanhGia: row._count._all,
      });
    }
    return summaries;
  }

  async isPublicHotel(maKhachSan: number): Promise<boolean> {
    const prisma = getPrismaClient();
    return (await prisma.kHACH_SAN.count({ where: { MaKhachSan: maKhachSan, TrangThai: HOTEL_STATUS.ACTIVE } })) > 0;
  }

  async findBookingForReview(maDatPhong: number) {
    const prisma = getPrismaClient();
    return prisma.dAT_PHONG.findUnique({
      where: { MaDatPhong: maDatPhong },
      select: { MaDatPhong: true, MaTaiKhoanKhachHang: true, MaKhachSan: true, TrangThai: true },
    });
  }

  async findByBookingId(maDatPhong: number) {
    const prisma = getPrismaClient();
    return prisma.dANH_GIA.findUnique({
      where: { MaDatPhong: maDatPhong },
      include: { HINH_ANH_DANH_GIA: true },
    });
  }

  async create(data: CreateReviewData, imageUrls: string[]) {
    const prisma = getPrismaClient();
    return prisma.dANH_GIA.create({
      data: {
        DAT_PHONG: { connect: { MaDatPhong: data.maDatPhong } },
        TAI_KHOAN: { connect: { MaTaiKhoan: data.maKhachHang } },
        KHACH_SAN: { connect: { MaKhachSan: data.maKhachSan } },
        DiemDanhGia: data.diemDanhGia,
        NoiDung: data.noiDung,
        TrangThai: data.trangThai,
        HINH_ANH_DANH_GIA: { create: imageUrls.map((url) => ({ URL: url })) },
      },
      include: { HINH_ANH_DANH_GIA: true },
    });
  }

  async findByIdAdmin(maDanhGia: number) {
    const prisma = getPrismaClient();
    return prisma.dANH_GIA.findUnique({
      where: { MaDanhGia: maDanhGia },
      include: adminReviewDetailInclude,
    });
  }

  async listAdmin(query: AdminListReviewsQuery) {
    const prisma = getPrismaClient();
    const where: Prisma.DANH_GIAWhereInput = {
      ...(query.trangThai ? { TrangThai: query.trangThai } : {}),
      ...(query.diemDanhGia ? { DiemDanhGia: query.diemDanhGia } : {}),
      ...(query.search
        ? {
            OR: [
              { NoiDung: { contains: query.search } },
              { TAI_KHOAN: { HoTen: { contains: query.search } } },
              { KHACH_SAN: { TenKhachSan: { contains: query.search } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.dANH_GIA.findMany({
        where,
        orderBy: { MaDanhGia: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          HINH_ANH_DANH_GIA: true,
          TAI_KHOAN: { select: { MaTaiKhoan: true, HoTen: true, Email: true } },
          KHACH_SAN: { select: { MaKhachSan: true, TenKhachSan: true } },
        },
      }),
      prisma.dANH_GIA.count({ where }),
    ]);

    return { items, total };
  }

  async updateStatus(maDanhGia: number, trangThai: string) {
    const prisma = getPrismaClient();
    return prisma.dANH_GIA.update({
      where: { MaDanhGia: maDanhGia },
      data: { TrangThai: trangThai },
      include: adminReviewDetailInclude,
    });
  }
}
