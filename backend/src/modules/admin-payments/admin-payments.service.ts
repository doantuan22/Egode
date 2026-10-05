import { getPrismaClient } from '../../config/prisma';
import { AppError } from '../../common/errors/app-error';
import { addDaysToDateKey, businessDayStart, dateKeyOf } from '../../common/utils/business-time';
import type { PaymentsQuery } from './admin-payments.schemas';

// Deliberately select only staff-operational data. Credentials, email, payment-provider
// signatures and callback payloads must never be returned by the admin read API.
const include = {
  DAT_PHONG: {
    include: {
      TAI_KHOAN: { select: { MaTaiKhoan: true, HoTen: true } },
      KHACH_SAN: { select: { MaKhachSan: true, TenKhachSan: true } },
    },
  },
  HOAN_TIEN: true,
} as const;

export class AdminPaymentsService {
  async list(query: PaymentsQuery) {
    const prisma = getPrismaClient();
    const where = {
      ...(query.TrangThai ? { TrangThai: query.TrangThai } : {}),
      ...(query.PhuongThucThanhToan ? { PhuongThucThanhToan: query.PhuongThucThanhToan } : {}),
      ...(query.coHoanTien === true ? { HOAN_TIEN: { some: {} } } : query.coHoanTien === false ? { HOAN_TIEN: { none: {} } } : {}),
      ...((query.from || query.to) ? { ThoiGianGiaoDich: { ...(query.from ? { gte: businessDayStart(dateKeyOf(query.from)) } : {}), ...(query.to ? { lt: businessDayStart(addDaysToDateKey(dateKeyOf(query.to), 1)) } : {}) } } : {}),
      ...(query.search ? { OR: [{ MaGiaoDichDoiTac: { contains: query.search } }, { DAT_PHONG: { MaXacNhanDatPhong: { contains: query.search } } }] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.tHANH_TOAN.findMany({ where, include, orderBy: { ThoiGianGiaoDich: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }),
      prisma.tHANH_TOAN.count({ where }),
    ]);
    return { items, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) } };
  }

  async getOne(id: number) {
    const payment = await getPrismaClient().tHANH_TOAN.findUnique({ where: { MaThanhToan: id }, include });
    if (!payment) throw AppError.notFound('Không tìm thấy giao dịch thanh toán');
    return payment;
  }
}
