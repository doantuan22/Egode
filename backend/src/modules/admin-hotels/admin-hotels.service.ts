import { getPrismaClient } from '../../config/prisma';
import { AppError } from '../../common/errors/app-error';
import { HOTEL_STATUS } from '../../common/constants/hotel-status';
import type { ListHotelsQuery, UpdateHotelInput } from './admin-hotels.schemas';

/**
 * Hotel approval state machine (admin side):
 *   Chờ duyệt ── approve ─→ Hoạt động      Hoạt động ── suspend ───→ Đình chỉ
 *   Chờ duyệt ── reject ──→ Từ chối        Đình chỉ ─── reactivate → Hoạt động
 * Every transition is a single guarded UPDATE (`WHERE TrangThai = <expected>`), so two admins acting on the
 * same hotel cannot both succeed and no endpoint can be used to skip a state (e.g. reactivate ≠ approve).
 */
export class AdminHotelsService {
  async list(q: ListHotelsQuery) {
    const prisma = getPrismaClient();
    const where = {
      ...(q.TrangThai ? { TrangThai: q.TrangThai } : {}),
      ...(q.search ? { TenKhachSan: { contains: q.search } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.kHACH_SAN.findMany({
        where,
        include: { DIA_PHUONG: true },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { NgayDangKy: 'desc' },
      }),
      prisma.kHACH_SAN.count({ where }),
    ]);
    return {
      items,
      pagination: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
    };
  }

  async getOne(id: number) {
    const hotel = await getPrismaClient().kHACH_SAN.findUnique({
      where: { MaKhachSan: id },
      include: { DIA_PHUONG: true, HINH_ANH_KHACH_SAN: true, KHACH_SAN_TIEN_NGHI: { include: { TIEN_NGHI: true } } },
    });
    if (!hotel) throw AppError.notFound('Không tìm thấy khách sạn');
    return hotel;
  }

  async update(id: number, input: UpdateHotelInput) {
    await this.getOne(id);
    return getPrismaClient().kHACH_SAN.update({ where: { MaKhachSan: id }, data: { ...input, NgayCapNhat: new Date() } });
  }

  /** Chờ duyệt → Hoạt động, recording who approved and when, in one statement. */
  async approve(id: number, adminId: number) {
    const now = new Date();
    return this.transition(id, HOTEL_STATUS.PENDING_APPROVAL, HOTEL_STATUS.ACTIVE, 'Chỉ có thể duyệt khách sạn đang chờ duyệt', {
      MaTaiKhoanDuyet: adminId,
      NgayDuyet: now,
      NgayCapNhat: now,
    });
  }

  /**
   * Chờ duyệt → Từ chối. Deliberately leaves MaTaiKhoanDuyet/NgayDuyet empty: those two columns mean
   * "approved by/at" and are what later tells an owner-side reactivation that the hotel was once approved.
   */
  async reject(id: number) {
    return this.transition(id, HOTEL_STATUS.PENDING_APPROVAL, HOTEL_STATUS.REJECTED, 'Chỉ có thể từ chối khách sạn đang chờ duyệt', {
      NgayCapNhat: new Date(),
    });
  }

  async suspend(id: number) {
    const hotel = await this.getOne(id);
    if (hotel.TrangThai === HOTEL_STATUS.SUSPENDED) return hotel;
    return this.transition(id, HOTEL_STATUS.ACTIVE, HOTEL_STATUS.SUSPENDED, 'Chỉ có thể đình chỉ khách sạn đang hoạt động', {
      NgayCapNhat: new Date(),
    });
  }

  async reactivate(id: number) {
    return this.transition(id, HOTEL_STATUS.SUSPENDED, HOTEL_STATUS.ACTIVE, 'Chỉ có thể kích hoạt lại khách sạn đang bị đình chỉ', {
      NgayCapNhat: new Date(),
    });
  }

  private async transition(
    id: number,
    from: string,
    to: string,
    invalidStateMessage: string,
    data: { MaTaiKhoanDuyet?: number; NgayDuyet?: Date; NgayCapNhat: Date }
  ) {
    const prisma = getPrismaClient();
    const changed = await prisma.kHACH_SAN.updateMany({ where: { MaKhachSan: id, TrangThai: from }, data: { ...data, TrangThai: to } });
    if (changed.count === 0) {
      await this.getOne(id); // 404 when the hotel does not exist
      throw AppError.badRequest(invalidStateMessage);
    }
    return this.getOne(id);
  }
}
