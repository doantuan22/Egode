import { PROMOTION_STATUS } from '../../common/constants/commercial';
import { businessToday, dateKeyOf } from '../../common/utils/business-time';
import { promotionUnavailableReason } from '../quotes/promotion-pricing';
import { PromotionsRepository } from './promotions.repository';

/** What a guest may see of a promotion: how to use it and until when — never usage counters or internal ids. */
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

  /**
   * The codes a guest can pick while booking right now: active, today (Vietnam day) inside the promotion's
   * window, and not out of uses. The same rules a typed code goes through when the quote is priced.
   */
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
