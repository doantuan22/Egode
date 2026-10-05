import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { useConfirm } from '../../components/common/FeedbackProvider';
import { approveAdminHotel, getAdminHotel, reactivateAdminHotel, rejectAdminHotel, suspendAdminHotel, updateAdminHotel, type UpdateAdminHotelPayload } from '../../features/admin/hotels/api';
import { PageSpinner } from '../../components/common/PageSpinner';
import { Button } from '../../components/common/Button';

type HotelAction = 'update' | 'approve' | 'reject' | 'suspend' | 'reactivate';

export default function AdminHotelDetailPage() {
  const id = Number(useParams().id); 
  const queryClient = useQueryClient();
  
  const query = useQuery({ queryKey: ['admin', 'hotels', id], queryFn: () => getAdminHotel(id) });
  
  const [saved, setSaved] = useState(false);
  const mutation = useMutation({ 
    mutationFn: ({ action, payload }: { action: HotelAction; payload?: Partial<UpdateAdminHotelPayload> }) => {
      switch (action) {
        case 'update': return updateAdminHotel(id, payload ?? {});
        case 'approve': return approveAdminHotel(id);
        case 'reject': return rejectAdminHotel(id);
        case 'suspend': return suspendAdminHotel(id);
        case 'reactivate': return reactivateAdminHotel(id);
      }
    },
    onSuccess: () => { setSaved(true); queryClient.invalidateQueries({ queryKey: ['admin', 'hotels'] }); } 
  });
  const confirm = useConfirm();
  
  useEffect(() => { if (mutation.isError) setSaved(false); }, [mutation.isError]);
  
  if (query.isLoading) return <PageSpinner />;
  if (query.isError || !query.data) return <div role="alert" className="mx-auto max-w-md rounded-lg bg-danger-light px-4 py-3 text-center text-sm text-danger-ink border border-danger/30">{query.error instanceof ApiError ? query.error.message : 'Không tìm thấy khách sạn'}</div>;
  
  const hotel = query.data;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => { 
    event.preventDefault(); 
    setSaved(false); 
    const form = new FormData(event.currentTarget); 
    mutation.mutate({ 
      action: 'update', 
      payload: { 
        TenKhachSan: String(form.get('TenKhachSan')), 
        DiaChiChiTiet: String(form.get('DiaChiChiTiet')), 
        HangSao: Number(form.get('HangSao')), 
        MoTa: String(form.get('MoTa')) || null,
        GioNhanPhong: String(form.get('GioNhanPhong')),
        GioTraPhong: String(form.get('GioTraPhong'))
      }
    }); 
  };
  
  const suspend = async () => {
    if (await confirm({ title: 'Đình chỉ khách sạn?', description: 'Cơ sở sẽ không thể tiếp nhận đặt phòng mới.', confirmLabel: 'Đình chỉ', variant: 'danger' })) mutation.mutate({ action: 'suspend' });
  };
  const approve = async () => {
    if (await confirm({ title: 'Duyệt khách sạn?', description: `Khách sạn ${query.data?.TenKhachSan ?? ''} sẽ được hiển thị công khai và nhận đặt phòng.`, confirmLabel: 'Duyệt' })) mutation.mutate({ action: 'approve' });
  };
  const reject = async () => {
    if (await confirm({ title: 'Từ chối khách sạn?', description: 'Khách sạn sẽ không được hiển thị công khai.', confirmLabel: 'Từ chối', variant: 'danger' })) mutation.mutate({ action: 'reject' });
  };
  const reactivate = async () => {
    if (await confirm({ title: 'Kích hoạt lại khách sạn?', description: `Khách sạn ${query.data?.TenKhachSan ?? ''} sẽ được chuyển về trạng thái hoạt động.`, confirmLabel: 'Kích hoạt lại' })) mutation.mutate({ action: 'reactivate' });
  };
  
  const isActive = hotel.TrangThai === 'Hoạt động';
  const isPending = hotel.TrangThai === 'Chờ duyệt';
  const isSuspended = hotel.TrangThai === 'Đình chỉ';

  return (
    <div className="flex flex-col gap-6 max-w-[800px] mx-auto w-full">
      <Link to="/admin/hotels" className="breadcrumb w-fit">
        <i className="ph ph-arrow-left"></i>
        <span>Quay lại danh sách</span>
      </Link>

      <div className="bg-white border border-border rounded-[16px] shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-surface-secondary flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
              <i className="ph-fill ph-buildings text-[24px]"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-heading">{hotel.TenKhachSan}</h3>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${isActive ? 'bg-success-light text-success-ink border-success/30' : 'bg-danger-light text-danger-ink border-danger/30'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-success' : 'bg-danger'}`}></span>
                  {hotel.TrangThai}
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-0.5 font-mono">Mã cơ sở: #{hotel.MaKhachSan}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {mutation.isSuccess && saved && (
            <div role="status" className="p-3 bg-success-light border border-success/30 rounded-xl text-success-ink text-sm font-medium">
              Cập nhật khách sạn thành công
            </div>
          )}
          {mutation.isError && (
            <div role="alert" className="p-3 bg-danger-light border border-danger/30 rounded-xl text-danger-ink text-sm font-medium">
              {mutation.error instanceof ApiError ? mutation.error.message : 'Thao tác thất bại, vui lòng thử lại'}
            </div>
          )}

          {/* Form Thông tin */}
          <div className="bg-surface-secondary border border-border rounded-2xl p-5 space-y-3">
            <h4 className="font-bold text-ink-sub uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <i className="ph-fill ph-info text-primary"></i> Thông tin cơ sở & Chính sách
            </h4>
            
            <form onSubmit={onSubmit} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label htmlFor="admin-hotel-detail-TenKhachSan" className="text-xs font-semibold text-ink-sub block">Tên khách sạn <span className="text-danger">*</span></label>
                <input id="admin-hotel-detail-TenKhachSan" type="text" name="TenKhachSan" defaultValue={hotel.TenKhachSan} required className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="admin-hotel-detail-field-1" className="text-xs font-semibold text-ink-sub block">Địa phương</label>
                  <input id="admin-hotel-detail-field-1" type="text" readOnly value={hotel.DIA_PHUONG?.TenThanhPho ?? '—'} className="w-full px-3 py-2 bg-surface-tertiary border border-border rounded-xl text-sm text-ink-muted outline-none cursor-not-allowed" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="admin-hotel-detail-HangSao" className="text-xs font-semibold text-ink-sub block">Hạng sao <span className="text-danger">*</span></label>
                  <select id="admin-hotel-detail-HangSao" name="HangSao" defaultValue={hotel.HangSao} required className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition">
                    <option value="5">★★★★★ (5 sao)</option>
                    <option value="4">★★★★☆ (4 sao)</option>
                    <option value="3">★★★☆☆ (3 sao)</option>
                    <option value="2">★★☆☆☆ (2 sao)</option>
                    <option value="1">★☆☆☆☆ (1 sao)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="admin-hotel-detail-DiaChiChiTiet" className="text-xs font-semibold text-ink-sub block">Địa chỉ chi tiết <span className="text-danger">*</span></label>
                <input id="admin-hotel-detail-DiaChiChiTiet" type="text" name="DiaChiChiTiet" defaultValue={hotel.DiaChiChiTiet} required className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="admin-hotel-detail-GioNhanPhong" className="text-xs font-semibold text-ink-sub block">Giờ nhận phòng <span className="text-danger">*</span></label>
                  <input id="admin-hotel-detail-GioNhanPhong" type="time" name="GioNhanPhong" defaultValue={hotel.GioNhanPhong ?? '14:00'} required className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="admin-hotel-detail-GioTraPhong" className="text-xs font-semibold text-ink-sub block">Giờ trả phòng <span className="text-danger">*</span></label>
                  <input id="admin-hotel-detail-GioTraPhong" type="time" name="GioTraPhong" defaultValue={hotel.GioTraPhong ?? '12:00'} required className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="admin-hotel-detail-MoTa" className="text-xs font-semibold text-ink-sub block">Mô tả cơ sở</label>
                <textarea id="admin-hotel-detail-MoTa" name="MoTa" defaultValue={hotel.MoTa ?? ''} rows={4} className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition resize-none"></textarea>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={mutation.isPending}>
                  <i className="ph ph-floppy-disk"></i> {mutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                </Button>
              </div>
            </form>
          </div>

          {/* Quản lý Trạng thái */}
          <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
            <h4 className="font-bold text-ink-sub uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <i className="ph-fill ph-shield-warning text-warning"></i> Quản lý vận hành & Trạng thái
            </h4>
            <div className="text-xs text-ink-muted leading-relaxed mb-3">
              {isPending
                ? 'Khách sạn đang chờ duyệt và chưa hiển thị công khai. Duyệt để cho phép nhận đặt phòng, hoặc từ chối hồ sơ.'
                : 'Đình chỉ khách sạn sẽ ẩn cơ sở khỏi kết quả tìm kiếm và ngăn chặn các đặt phòng mới. Tuy nhiên, các đặt phòng hiện tại vẫn phải được khách sạn xử lý.'}
            </div>
            
            <div className="flex items-center gap-3 pt-1">
              {isPending && (
                <>
                  <Button type="button" onClick={approve} disabled={mutation.isPending} variant="success-outline">
                    <i className="ph ph-check-circle"></i> {mutation.isPending ? 'Đang xử lý...' : 'Duyệt khách sạn'}
                  </Button>
                  <Button type="button" onClick={reject} disabled={mutation.isPending} variant="danger-outline">
                    <i className="ph ph-x-circle"></i> {mutation.isPending ? 'Đang xử lý...' : 'Từ chối'}
                  </Button>
                </>
              )}
              {isActive && (
                <Button
                  type="button"
                  onClick={suspend}
                  disabled={mutation.isPending} variant="danger-outline"
                >
                  <i className="ph ph-prohibit"></i> {mutation.isPending ? 'Đang xử lý...' : 'Tạm đình chỉ hoạt động'}
                </Button>
              )}
              {isSuspended && (
                <Button
                  type="button"
                  onClick={reactivate}
                  disabled={mutation.isPending} variant="success-outline"
                >
                  <i className="ph ph-check-circle"></i> {mutation.isPending ? 'Đang xử lý...' : 'Kích hoạt lại cơ sở'}
                </Button>
              )}
              {!isPending && !isActive && !isSuspended && (
                <p className="text-xs text-ink-muted">Không có thao tác nào khả dụng ở trạng thái "{hotel.TrangThai}".</p>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
