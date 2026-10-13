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
 * Why a promotion cannot be used by a booking made right now, or `null` when it can: status, the date window
 * (read on the Vietnam calendar day the guest is booking, not on the stay dates) and the usage cap. The one
 * source for both pricing a code the guest typed and listing the codes the guest may pick.
 */
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
