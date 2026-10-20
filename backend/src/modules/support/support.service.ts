import { SupportRepository } from './support.repository';
import { AppError } from '../../common/errors/app-error';
import { SUPPORT_STATUS } from '../../common/constants/support';
import type { ApiPaginationMeta } from '../../common/types/api-response';
import type { CreateSupportInput, AdminUpdateSupportInput, AdminListSupportQuery } from './support.schemas';

export class SupportService {
  constructor(private readonly repository: SupportRepository = new SupportRepository()) {}

  async create(customerId: number, input: CreateSupportInput) {
    if (input.maDatPhong) {
      // Yêu cầu gắn với đơn phải thuộc về khách gửi
      const booking = await this.repository.findBookingOwner(input.maDatPhong);
      if (!booking) throw AppError.badRequest('Đặt phòng không tồn tại');
      if (booking.MaTaiKhoanKhachHang !== customerId) {
        throw AppError.forbidden('Đặt phòng này không thuộc về bạn');
      }
    }

    return this.repository.create({
      maTaiKhoanKhachHang: customerId,
      maDatPhong: input.maDatPhong ?? null,
      loaiYeuCau: input.loaiYeuCau,
      tieuDe: input.tieuDe,
      noiDung: input.noiDung,
      trangThai: SUPPORT_STATUS.NEW,
      ngayTao: new Date(),
    });
  }

  async listMine(customerId: number) {
    return this.repository.listByCustomer(customerId);
  }

  async getMine(maYeuCauHoTro: number, customerId: number) {
    const request = await this.repository.findById(maYeuCauHoTro);
    if (!request) throw AppError.notFound('Không tìm thấy yêu cầu hỗ trợ');
    if (request.MaTaiKhoanKhachHang !== customerId) {
      throw AppError.forbidden('Bạn không có quyền xem yêu cầu này');
    }
    return request;
  }

  async adminList(query: AdminListSupportQuery) {
    const { items, total } = await this.repository.listAdmin(query);
    const pagination: ApiPaginationMeta = {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
    return { items, pagination };
  }

  async adminGetById(maYeuCauHoTro: number) {
    const request = await this.repository.findById(maYeuCauHoTro);
    if (!request) throw AppError.notFound('Không tìm thấy yêu cầu hỗ trợ');
    return request;
  }

  /** Người xử lý lấy từ admin đã đăng nhập */
  async adminUpdate(maYeuCauHoTro: number, adminId: number, input: AdminUpdateSupportInput) {
    const existing = await this.repository.findById(maYeuCauHoTro);
    if (!existing) throw AppError.notFound('Không tìm thấy yêu cầu hỗ trợ');
    if (existing.TrangThai === SUPPORT_STATUS.RESOLVED) {
      throw AppError.badRequest('Yêu cầu này đã được xử lý xong');
    }

    return this.repository.update(maYeuCauHoTro, {
      trangThai: input.trangThai,
      ketQuaXuLy: input.ketQuaXuLy,
      maTaiKhoanXuLy: adminId,
      ngayXuLy: input.trangThai === SUPPORT_STATUS.RESOLVED ? new Date() : undefined,
    });
  }
}
