import { PROMOTION_STATUS } from '../../common/constants/commercial';
import { businessToday, dateKeyOf } from '../../common/utils/business-time';
import { promotionUnavailableReason } from '../quotes/promotion-pricing';
import { PromotionsRepository } from './promotions.repository';

/** Thông tin khuyến mãi khách được xem */
export interface AvailablePromotion {
  MaCode: string;
  LoaiGiamGia: string;
  GiaTriGiam: number;
  GiaTriDonToiThieu: number;
  MucGiamToiDa: number;
  NgayBatDau: string;
  NgayKetThuc: string;
}

const toNumber = (value: unknown): number => Number(value);

export class PublicPromotionsService {
  constructor(private readonly repository: PromotionsRepository = new PromotionsRepository()) {}

  /** Các mã khách chọn được ở thời điểm đặt phòng */
  async listAvailable(now: Date = new Date()): Promise<AvailablePromotion[]> {
    const candidates = await this.repository.findActiveOnDay(businessToday(now), PROMOTION_STATUS.ACTIVE);
    const used = await this.repository.countUsageByIds(candidates.map((promo) => promo.MaKhuyenMai));

    return candidates
      .filter((promo) => promotionUnavailableReason(promo, now, used.get(promo.MaKhuyenMai) ?? 0) === null)
      .map((promo) => ({
        MaCode: promo.MaCode,
        LoaiGiamGia: promo.LoaiGiamGia,
        GiaTriGiam: toNumber(promo.GiaTriGiam),
        GiaTriDonToiThieu: toNumber(promo.GiaTriDonToiThieu),
        MucGiamToiDa: toNumber(promo.MucGiamToiDa),
        NgayBatDau: dateKeyOf(promo.NgayBatDau),
        NgayKetThuc: dateKeyOf(promo.NgayKetThuc),
      }));
  }
}
