/** Kiểm tra chéo các trường khi tạo và cập nhật khuyến mãi */
import { DISCOUNT_TYPE } from '../../common/constants/commercial';

export interface PromotionFields {
  LoaiGiamGia: string;
  GiaTriGiam: number;
  NgayBatDau: Date;
  NgayKetThuc: Date;
}

export const validatePromotionFields = (fields: PromotionFields): string | null => {
  if (fields.NgayKetThuc.getTime() < fields.NgayBatDau.getTime()) {
    return 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu';
  }
  if (fields.LoaiGiamGia === DISCOUNT_TYPE.PERCENT && fields.GiaTriGiam > 100) {
    return 'Giảm theo phần trăm không được vượt quá 100%';
  }
  return null;
};
