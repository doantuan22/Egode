import { z } from 'zod';

export const applyPartnerSchema = z.object({
  SoCCCD: z.string().min(9, 'Số CCCD không hợp lệ').max(20),
  SoGiayPhepKinhDoanh: z.string().min(1, 'Vui lòng nhập số giấy phép kinh doanh').max(50),
  MaSoThue: z.string().min(1, 'Vui lòng nhập mã số thuế').max(20),
  // Dùng URL tài liệu thay vì tải file
  TepGiayTo: z.string().min(1, 'Vui lòng cung cấp đường dẫn tệp giấy tờ').max(500),
});
export type ApplyPartnerInput = z.infer<typeof applyPartnerSchema>;

export const partnerApplicationIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const adminListPartnerApplicationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  trangThaiDuyet: z.string().trim().max(30).optional(),
});
export type AdminListPartnerApplicationsQuery = z.infer<typeof adminListPartnerApplicationsQuerySchema>;

export const rejectPartnerApplicationSchema = z.object({
  LyDoTuChoi: z.string().trim().min(1, 'Lý do từ chối là bắt buộc').max(500),
});
export type RejectPartnerApplicationInput = z.infer<typeof rejectPartnerApplicationSchema>;
