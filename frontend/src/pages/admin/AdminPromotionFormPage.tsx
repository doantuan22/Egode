import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCreatePromotion, usePromotionDetail, useSetPromotionStatus, useUpdatePromotion } from '../../features/promotions/hooks';
import { ApiError } from '../../services/apiClient';
import type { PromotionFormValues } from '../../features/promotions/types';
import { useConfirm } from '../../components/common/FeedbackProvider';
import { PageSpinner } from '../../components/common/PageSpinner';
import { Button } from '../../components/common/Button';
import { Select } from '../../components/common/Select';
import { DateField } from '../../components/common/DateField';

const DISCOUNT_TYPES = ['Phần trăm', 'Số tiền cố định'];

const emptyForm: PromotionFormValues = {
  MaCode: '',
  LoaiGiamGia: DISCOUNT_TYPES[0],
  GiaTriGiam: 10,
  GiaTriDonToiThieu: 0,
  MucGiamToiDa: 0,
  SoLuongGioiHan: 0,
  NgayBatDau: '',
  NgayKetThuc: '',
};

export default function AdminPromotionFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = id !== undefined;
  const promotionId = Number(id);
  const navigate = useNavigate();

  const detailQuery = usePromotionDetail(isEdit ? promotionId : -1);
  const createMutation = useCreatePromotion();
  const updateMutation = useUpdatePromotion();
  const statusMutation = useSetPromotionStatus();
  const confirm = useConfirm();

  const [form, setForm] = useState<PromotionFormValues>(emptyForm);

  useEffect(() => {
    if (detailQuery.data) {
      setForm({
        MaCode: detailQuery.data.MaCode,
        LoaiGiamGia: detailQuery.data.LoaiGiamGia,
        GiaTriGiam: detailQuery.data.GiaTriGiam,
        GiaTriDonToiThieu: detailQuery.data.GiaTriDonToiThieu,
        MucGiamToiDa: detailQuery.data.MucGiamToiDa,
        SoLuongGioiHan: detailQuery.data.SoLuongGioiHan,
        NgayBatDau: detailQuery.data.NgayBatDau.slice(0, 10),
        NgayKetThuc: detailQuery.data.NgayKetThuc.slice(0, 10),
      });
    }
  }, [detailQuery.data]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit) {
      updateMutation.mutate({ id: promotionId, payload: form });
    } else {
      createMutation.mutate(form, { onSuccess: (promo) => navigate(`/admin/promotions/${promo.MaKhuyenMai}`, { replace: true }) });
    }
  };

  const mutation = isEdit ? updateMutation : createMutation;

  if (isEdit && detailQuery.isLoading) {
    return <PageSpinner />;
  }

  if (isEdit && (detailQuery.isError || !detailQuery.data)) {
    return <div role="alert" className="mx-auto max-w-md rounded-lg bg-danger-light px-4 py-3 text-center text-sm text-danger-ink border border-danger/30">{detailQuery.error instanceof ApiError ? detailQuery.error.message : 'Không tìm thấy mã khuyến mãi'}</div>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-[800px] mx-auto w-full">
      <Link to="/admin/promotions" className="breadcrumb w-fit">
        <i className="ph ph-arrow-left"></i>
        <span>Quay lại danh sách</span>
      </Link>

      <div className="bg-white border border-border rounded-[16px] shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-surface-secondary flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
              <i className="ph-fill ph-ticket text-[24px]"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-heading">{isEdit ? 'Chỉnh sửa mã khuyến mãi' : 'Tạo mã khuyến mãi mới'}</h3>
                {isEdit && detailQuery.data && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${detailQuery.data.TrangThai === 'Hoạt động' ? 'bg-success-light text-success-ink border-success/30' : 'bg-danger-light text-danger-ink border-danger/30'}`}>
                    {detailQuery.data.TrangThai}
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                Thiết lập thông số và điều kiện áp dụng cho mã voucher
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {mutation.isError && (
             <div role="alert" className="p-3 bg-danger-light border border-danger/30 rounded-xl text-danger-ink text-sm font-medium">
               {mutation.error instanceof ApiError ? mutation.error.message : 'Không thể lưu mã khuyến mãi'}
             </div>
          )}
          {mutation.isSuccess && isEdit && (
             <div role="status" className="p-3 bg-success-light border border-success/30 rounded-xl text-success-ink text-sm font-medium">
               Lưu thay đổi thành công!
             </div>
          )}

          <div className="bg-surface-secondary border border-border rounded-2xl p-5 space-y-4">
             <form onSubmit={submit} className="space-y-4 pt-1">
                <div className="space-y-1.5">
                  <label htmlFor="admin-promotion-form-field-1" className="text-xs font-semibold text-ink-sub block">Mã code <span className="text-danger">*</span></label>
                  <input id="admin-promotion-form-field-1" 
                    type="text" 
                    required 
                    value={form.MaCode}
                    onChange={(e) => setForm((f) => ({ ...f, MaCode: e.target.value.toUpperCase() }))}
                    placeholder="VD: EGODEHOT"
                    className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition uppercase"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="admin-promotion-form-field-2" className="text-xs font-semibold text-ink-sub block">Loại giảm giá <span className="text-danger">*</span></label>
                    <Select id="admin-promotion-form-field-2" 
                      required
                      value={form.LoaiGiamGia}
                      onChange={(e) => setForm((f) => ({ ...f, LoaiGiamGia: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                    >
                      {DISCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="admin-promotion-form-ml-1" className="text-xs font-semibold text-ink-sub block">
                      Giá trị giảm {form.LoaiGiamGia === 'Phần trăm' ? '(%, tối đa 100)' : '(VNĐ)'} <span className="text-danger">*</span>
                    </label>
                    <input id="admin-promotion-form-ml-1" 
                      type="number" 
                      required 
                      min={1}
                      max={form.LoaiGiamGia === 'Phần trăm' ? 100 : undefined}
                      value={form.GiaTriGiam}
                      onChange={(e) => setForm((f) => ({ ...f, GiaTriGiam: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="admin-promotion-form-field-3" className="text-xs font-semibold text-ink-sub block">Giá trị đơn tối thiểu (VNĐ)</label>
                    <input id="admin-promotion-form-field-3" 
                      type="number" 
                      min={0}
                      value={form.GiaTriDonToiThieu}
                      onChange={(e) => setForm((f) => ({ ...f, GiaTriDonToiThieu: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="admin-promotion-form-field-4" className="text-xs font-semibold text-ink-sub block">Mức giảm tối đa (VNĐ, 0 = không giới hạn)</label>
                    <input id="admin-promotion-form-field-4" 
                      type="number" 
                      min={0}
                      value={form.MucGiamToiDa}
                      onChange={(e) => setForm((f) => ({ ...f, MucGiamToiDa: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="admin-promotion-form-field-5" className="text-xs font-semibold text-ink-sub block">Số lượng giới hạn (0 = không giới hạn)</label>
                  <input id="admin-promotion-form-field-5" 
                    type="number" 
                    min={0}
                    value={form.SoLuongGioiHan}
                    onChange={(e) => setForm((f) => ({ ...f, SoLuongGioiHan: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                  />
                  {isEdit && detailQuery.data && (
                    <p className="text-[11px] text-ink-muted mt-1 block">Đã sử dụng: {detailQuery.data.SoLuongDaSuDung} lượt</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="admin-promotion-form-field-6" className="text-xs font-semibold text-ink-sub block">Ngày bắt đầu <span className="text-danger">*</span></label>
                    <DateField id="admin-promotion-form-field-6" 
                      type="date" 
                      required 
                      value={form.NgayBatDau}
                      onChange={(e) => setForm((f) => ({ ...f, NgayBatDau: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="admin-promotion-form-field-7" className="text-xs font-semibold text-ink-sub block">Ngày kết thúc <span className="text-danger">*</span></label>
                    <DateField id="admin-promotion-form-field-7" 
                      type="date" 
                      required 
                      value={form.NgayKetThuc}
                      onChange={(e) => setForm((f) => ({ ...f, NgayKetThuc: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border mt-2">
                  <Button type="submit" disabled={mutation.isPending} className="flex-1">
                    {mutation.isPending ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo mã mới'}
                  </Button>
                  
                  {isEdit && detailQuery.data && (
                    <Button
                      type="button"
                      disabled={statusMutation.isPending}
                      loading={statusMutation.isPending}
                      variant={detailQuery.data.TrangThai === 'Hoạt động' ? 'danger-outline' : 'success-outline'}
                      className="flex-1"
                      onClick={async () => {
                        const activating = detailQuery.data!.TrangThai !== 'Hoạt động';
                        if (!activating && !await confirm({ title: 'Ngừng mã khuyến mãi?', description: 'Khách hàng sẽ không thể dùng mã này cho đặt phòng mới.', confirmLabel: 'Ngừng mã', variant: 'danger' })) return;
                        statusMutation.mutate({ id: promotionId, active: activating });
                      }}
                    >
                      {detailQuery.data.TrangThai === 'Hoạt động' ? 'Tắt mã' : 'Bật mã'}
                    </Button>
                  )}
                </div>

             </form>
          </div>

        </div>
      </div>
    </div>
  );
}
