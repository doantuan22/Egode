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

/** A promotion runs on calendar days (DATE columns); "today" is the Vietnam day, compared as `YYYY-MM-DD` strings. */

/**
 * Pure evaluation of a single promotion against a quote subtotal — no DB
 * access here (usedCount is looked up by the caller) so every business rule
 * (window, status, minimum order, usage cap, discount type + max cap) is
 * independently unit-testable.
 */
export function evaluatePromotion(
  promo: PromotionRecord,
  tongTienPhong: number,
  now: Date,
  usedCount: number
): PromotionEvalResult {
  if (promo.TrangThai !== PROMOTION_STATUS.ACTIVE) {
    return { valid: false, reason: 'Mã khuyến mãi hiện không hoạt động', discount: 0 };
  }

  const today = businessToday(now);
  if (today < dateKeyOf(promo.NgayBatDau)) {
    return { valid: false, reason: 'Mã khuyến mãi chưa bắt đầu áp dụng', discount: 0 };
  }
  if (today > dateKeyOf(promo.NgayKetThuc)) {
    return { valid: false, reason: 'Mã khuyến mãi đã hết hạn', discount: 0 };
  }

  if (promo.SoLuongGioiHan > 0 && usedCount >= promo.SoLuongGioiHan) {
    return { valid: false, reason: 'Mã khuyến mãi đã hết lượt sử dụng', discount: 0 };
  }

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
    // MucGiamToiDa = 0 is treated as "no cap set" (Chương 6: "có ý nghĩa với
    // giảm theo %" — a legitimate percent promo would not be configured with
    // a nonsensical zero cap).
    if (promo.MucGiamToiDa > 0) {
      discount = Math.min(discount, promo.MucGiamToiDa);
    }
  } else {
    discount = promo.GiaTriGiam;
  }

  // Never discount more than the subtotal (matches DAT_PHONG's own
  // CK_DAT_PHONG_SoTienGiam <= TongTienPhong check).
  discount = Math.min(discount, tongTienPhong);
  discount = Math.round(discount);

  return { valid: true, reason: null, discount };
}
