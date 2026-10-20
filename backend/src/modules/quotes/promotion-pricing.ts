import { PROMOTION_STATUS, DISCOUNT_TYPE } from '../../common/constants/commercial';
import { businessToday, dateKeyOf } from '../../common/utils/business-time';

export interface PromotionRecord {
  MaKhuyenMai: number;
  MaCode: string;
  LoaiGiamGia: string;
  GiaTriGiam: number;
  GiaTriDonToiThieu: number;
  MucGiamToiDa: number;
  SoLuongGioiHan: number;
  NgayBatDau: Date;
  NgayKetThuc: Date;
  TrangThai: string;
}

export interface PromotionEvalResult {
  valid: boolean;
  reason: string | null;
  discount: number;
}

/** Khuyến mãi tính theo ngày lịch Việt Nam */

/** Lý do khuyến mãi không dùng được ở thời điểm đặt */
export function promotionUnavailableReason(
  promo: Pick<PromotionRecord, 'TrangThai' | 'NgayBatDau' | 'NgayKetThuc' | 'SoLuongGioiHan'>,
  now: Date,
  usedCount: number
): string | null {
  if (promo.TrangThai !== PROMOTION_STATUS.ACTIVE) return 'Mã khuyến mãi hiện không hoạt động';

  const today = businessToday(now);
  if (today < dateKeyOf(promo.NgayBatDau)) return 'Mã khuyến mãi chưa bắt đầu áp dụng';
  if (today > dateKeyOf(promo.NgayKetThuc)) return 'Mã khuyến mãi đã hết hạn';

  if (promo.SoLuongGioiHan > 0 && usedCount >= promo.SoLuongGioiHan) return 'Mã khuyến mãi đã hết lượt sử dụng';
  return null;
}

/** Đánh giá một khuyến mãi trên tạm tính của báo giá */
export function evaluatePromotion(
  promo: PromotionRecord,
  tongTienPhong: number,
  now: Date,
  usedCount: number
): PromotionEvalResult {
  const unavailable = promotionUnavailableReason(promo, now, usedCount);
  if (unavailable) return { valid: false, reason: unavailable, discount: 0 };

  if (tongTienPhong < promo.GiaTriDonToiThieu) {
    return {
      valid: false,
      reason: 'Đơn hàng chưa đạt giá trị tối thiểu để áp dụng mã này',
      discount: 0,
    };
  }

  let discount: number;
  if (promo.LoaiGiamGia === DISCOUNT_TYPE.PERCENT) {
    discount = tongTienPhong * (promo.GiaTriGiam / 100);
    // Mức giảm tối đa bằng 0 nghĩa là không giới hạn
    if (promo.MucGiamToiDa > 0) {
      discount = Math.min(discount, promo.MucGiamToiDa);
    }
  } else {
    discount = promo.GiaTriGiam;
  }

  // Không giảm quá tạm tính
  discount = Math.min(discount, tongTienPhong);
  discount = Math.round(discount);

  return { valid: true, reason: null, discount };
}
