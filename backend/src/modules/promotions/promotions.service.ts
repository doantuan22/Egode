import { PromotionsRepository } from './promotions.repository';
import { validatePromotionFields } from './promotion-validation';
import { AppError } from '../../common/errors/app-error';
import { PROMOTION_STATUS, PROMOTION_SCOPE } from '../../common/constants/commercial';
import type { ApiPaginationMeta } from '../../common/types/api-response';
import type { CreatePromotionInput, ListPromotionsQuery, UpdatePromotionInput } from './promotions.schemas';

const toNumber = (value: unknown): number => Number(value);

export class PromotionsService {
  constructor(private readonly repository: PromotionsRepository = new PromotionsRepository()) {}

  async list(query: ListPromotionsQuery) {
    const { items, total } = await this.repository.list(query);
    const pagination: ApiPaginationMeta = {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
    return { items, pagination };
  }

  async getById(maKhuyenMai: number) {
    const promo = await this.repository.findById(maKhuyenMai);
    if (!promo) throw AppError.notFound('Không tìm thấy mã khuyến mãi');
    const soLuongDaSuDung = await this.repository.countUsage(maKhuyenMai);
    return { ...promo, SoLuongDaSuDung: soLuongDaSuDung };
  }

  async create(input: CreatePromotionInput) {
    const existing = await this.repository.findByCode(input.MaCode);
    if (existing) throw AppError.conflict('Mã khuyến mãi đã tồn tại');

    const error = validatePromotionFields(input);
    if (error) throw AppError.badRequest(error);

    return this.repository.create({
      ...input,
      // Mọi khuyến mãi áp dụng toàn hệ thống
      PhamViApDung: PROMOTION_SCOPE.SYSTEM_WIDE,
      TrangThai: PROMOTION_STATUS.ACTIVE,
    });
  }

  async update(maKhuyenMai: number, input: UpdatePromotionInput) {
    const existing = await this.repository.findById(maKhuyenMai);
    if (!existing) throw AppError.notFound('Không tìm thấy mã khuyến mãi');

    if (input.MaCode && input.MaCode !== existing.MaCode) {
      const dup = await this.repository.findByCode(input.MaCode);
      if (dup) throw AppError.conflict('Mã khuyến mãi đã tồn tại');
    }

    const merged = {
      LoaiGiamGia: input.LoaiGiamGia ?? existing.LoaiGiamGia,
      GiaTriGiam: input.GiaTriGiam ?? toNumber(existing.GiaTriGiam),
      NgayBatDau: input.NgayBatDau ?? existing.NgayBatDau,
      NgayKetThuc: input.NgayKetThuc ?? existing.NgayKetThuc,
    };
    const error = validatePromotionFields(merged);
    if (error) throw AppError.badRequest(error);

    return this.repository.update(maKhuyenMai, input);
  }

  async activate(maKhuyenMai: number) {
    const existing = await this.repository.findById(maKhuyenMai);
    if (!existing) throw AppError.notFound('Không tìm thấy mã khuyến mãi');
    return this.repository.setStatus(maKhuyenMai, PROMOTION_STATUS.ACTIVE);
  }

  async deactivate(maKhuyenMai: number) {
    const existing = await this.repository.findById(maKhuyenMai);
    if (!existing) throw AppError.notFound('Không tìm thấy mã khuyến mãi');
    return this.repository.setStatus(maKhuyenMai, PROMOTION_STATUS.INACTIVE);
  }
}
