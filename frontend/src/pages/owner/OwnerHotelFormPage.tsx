import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Link } from 'react-router-dom';
import { useCreateHotel } from '../../features/owner/hooks';
import { useLocations } from '../../features/locations/hooks';
import { hotelFormSchema, HotelFormSchemaValues } from '../../features/owner/schemas';
import { ApiError } from '../../services/apiClient';
import { applyServerFieldErrors } from '../../lib/apiErrors';
import { cn } from '../../lib/utils';
import { Combobox } from '../../components/common/Combobox';
import { FormErrorSummary } from '../../components/common/FormErrorSummary';
import { Button } from '../../components/common/Button';
import { Select } from '../../components/common/Select';

export default function OwnerHotelFormPage() {
  const navigate = useNavigate();
  const createMutation = useCreateHotel();
  const locationsQuery = useLocations();

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<HotelFormSchemaValues>({
    resolver: zodResolver(hotelFormSchema),
    defaultValues: { GioNhanPhong: '14:00', GioTraPhong: '12:00', HangSao: 3 },
  });

  const onSubmit = async (values: HotelFormSchemaValues) => {
    try {
      const hotel = await createMutation.mutateAsync(values);
      navigate(`/owner/hotels/${hotel.MaKhachSan}`, { replace: true });
    } catch (error) {
      applyServerFieldErrors(error, setError, ['TenKhachSan', 'DiaChiChiTiet', 'HangSao', 'MoTa', 'GioNhanPhong', 'GioTraPhong', 'MaDiaPhuong']);
    }
  };

  return (
    <div className="owner-hotel-form flex flex-col gap-5 max-w-[1080px] mx-auto w-full">
      <Link to="/owner" className="breadcrumb w-fit">
        <i className="ph ph-arrow-left"></i>
        <span>Quay lại danh sách khách sạn</span>
      </Link>

      <header className="owner-form-heading flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-heading mb-0.5">Thêm khách sạn mới</h1>
          <p className="text-[13px] text-muted">Điền thông tin chi tiết của cơ sở lưu trú để gửi hồ sơ kiểm duyệt tới hệ thống.</p>
        </div>
      </header>

      <div className="bg-primary-50 border border-primary-200 rounded-xl px-4 py-3 flex gap-3 items-center text-[13px] text-primary-800">
        <i className="ph ph-info text-lg shrink-0" aria-hidden="true"></i>
        <div>
          <strong>Quy trình phê duyệt:</strong> Sau khi hoàn tất và nhấn <em>"Đăng ký khách sạn"</em>, quản trị viên sẽ thẩm định hồ sơ trước khi cấp phép hoạt động. Bạn có thể bổ sung tiện nghi và hình ảnh sau khi tạo hồ sơ.
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <FormErrorSummary
          errors={errors}
          fieldLabels={{ TenKhachSan: 'Tên khách sạn', HangSao: 'Hạng sao', MaDiaPhuong: 'Tỉnh / thành phố', DiaChiChiTiet: 'Địa chỉ', GioNhanPhong: 'Giờ nhận phòng', GioTraPhong: 'Giờ trả phòng', MoTa: 'Giới thiệu' }}
          fieldIds={{ TenKhachSan: 'owner-hotel-form-TenKhachSan', HangSao: 'owner-hotel-form-HangSao', MaDiaPhuong: 'owner-hotel-form-MaDiaPhuong', DiaChiChiTiet: 'owner-hotel-form-DiaChiChiTiet', GioNhanPhong: 'owner-hotel-form-GioNhanPhong', GioTraPhong: 'owner-hotel-form-GioTraPhong' }}
        />
        {createMutation.isError && (
          <div role="alert" className="rounded-lg bg-danger-light border border-danger/30 px-4 py-3 text-sm text-danger-ink">
            {createMutation.error instanceof ApiError ? createMutation.error.message : 'Đăng ký thất bại, vui lòng thử lại'}
          </div>
        )}

        <section className="owner-editor-section first:border-t border-b border-border py-6">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-heading mb-1">Thông tin cơ bản</h2>
            <p className="text-sm text-muted">Tên thương mại, tiêu chuẩn sao và địa chỉ hiển thị với du khách</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label htmlFor="owner-hotel-form-TenKhachSan" className="form-label">Tên cơ sở khách sạn / Resort <span className="text-danger">*</span></label>
              <input id="owner-hotel-form-TenKhachSan" type="text" className={cn("input", errors.TenKhachSan && "border-danger")} placeholder="Ví dụ: Grand Palace Saigon Hotel & Spa" {...register('TenKhachSan')} />
              {errors.TenKhachSan && <p className="text-xs text-danger mt-1">{errors.TenKhachSan.message}</p>}
            </div>

            <div>
              <label htmlFor="owner-hotel-form-HangSao" className="form-label">Xếp hạng sao tiêu chuẩn <span className="text-danger">*</span></label>
              <div className="relative">
                <Select id="owner-hotel-form-HangSao" className={cn("select", errors.HangSao && "border-danger")} {...register('HangSao', { valueAsNumber: true })}>
                  <option value="">-- Chọn xếp hạng sao --</option>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <option key={s} value={s}>{s} Sao</option>
                  ))}
                </Select>
                <i className="ph ph-caret-down absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"></i>
              </div>
            </div>

            <div>
              <Controller control={control} name="MaDiaPhuong" render={({ field }) => (
                <Combobox id="owner-hotel-form-MaDiaPhuong" label="Tỉnh / Thành phố" placeholder="Tìm tỉnh hoặc thành phố..."
                  options={(locationsQuery.data ?? []).map((location) => ({ value: String(location.MaDiaPhuong), label: location.TenThanhPho }))}
                  value={field.value ? String(field.value) : ''} onValueChange={(value) => field.onChange(value ? Number(value) : undefined)} error={errors.MaDiaPhuong?.message} />
              )} />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="owner-hotel-form-DiaChiChiTiet" className="form-label">Địa chỉ chi tiết <span className="text-danger">*</span></label>
              <input id="owner-hotel-form-DiaChiChiTiet" type="text" className={cn("input", errors.DiaChiChiTiet && "border-danger")} placeholder="Số nhà, tên đường, phường/xã, quận/huyện..." {...register('DiaChiChiTiet')} />
              {errors.DiaChiChiTiet && <p className="text-xs text-danger mt-1">{errors.DiaChiChiTiet.message}</p>}
            </div>
          </div>
        </section>

        <section className="owner-editor-section border-b border-border py-6">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-heading mb-1">Quy định vận hành & khung giờ</h2>
            <p className="text-sm text-muted">Thiết lập thời gian nhận và trả phòng tiêu chuẩn</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="owner-hotel-form-GioNhanPhong" className="form-label">Giờ nhận phòng tiêu chuẩn (Check-in) <span className="text-danger">*</span></label>
              <input id="owner-hotel-form-GioNhanPhong" type="time" className={cn("input", errors.GioNhanPhong && "border-danger")} {...register('GioNhanPhong')} />
              {errors.GioNhanPhong && <p className="text-xs text-danger mt-1">{errors.GioNhanPhong.message}</p>}
            </div>
            <div>
              <label htmlFor="owner-hotel-form-GioTraPhong" className="form-label">Giờ trả phòng tiêu chuẩn (Check-out) <span className="text-danger">*</span></label>
              <input id="owner-hotel-form-GioTraPhong" type="time" className={cn("input", errors.GioTraPhong && "border-danger")} {...register('GioTraPhong')} />
              {errors.GioTraPhong && <p className="text-xs text-danger mt-1">{errors.GioTraPhong.message}</p>}
            </div>
          </div>
        </section>

        <section className="owner-editor-section border-b border-border py-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-heading mb-1">Giới thiệu tổng quan</h2>
            <p className="text-sm text-muted">Đoạn văn ngắn làm nổi bật vị trí, phong cách kiến trúc và dịch vụ vượt trội</p>
          </div>
          <div>
            <textarea rows={4} className={cn("textarea", errors.MoTa && "border-danger")} placeholder="Mô tả khách sạn..." {...register('MoTa')}></textarea>
          </div>
        </section>

        <footer className="owner-form-actions flex justify-between items-center flex-wrap gap-3">
          <span className="text-[13px] text-muted flex items-center gap-1.5">
            <i className="ph ph-info"></i> Hãy kiểm tra kỹ trước khi gửi đăng ký
          </span>
          <div className="flex gap-3">
            <Link to="/owner" className="btn btn-secondary">Hủy bỏ</Link>
            <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
              {isSubmitting || createMutation.isPending ? 'Đang xử lý...' : 'Gửi đăng ký duyệt'}
            </Button>
          </div>
        </footer>
      </form>
    </div>
  );
}
