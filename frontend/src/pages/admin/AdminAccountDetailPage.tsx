import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  useAccountDetail,
  useUpdateAccount,
  useLockAccount,
  useUnlockAccount,
  useDeleteAccount,
} from '../../features/admin/accounts/hooks';
import type { UpdateAccountPayload } from '../../types/auth';
import { ApiError } from '../../services/apiClient';
import { useConfirm } from '../../components/common/FeedbackProvider';
import { useMe } from '../../features/auth/hooks';
import { PageSpinner } from '../../components/common/PageSpinner';
import { Button } from '../../components/common/Button';
import { Select } from '../../components/common/Select';
import { DateField } from '../../components/common/DateField';

export default function AdminAccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const accountId = Number(id);
  const confirm = useConfirm();

  const detailQuery = useAccountDetail(Number.isFinite(accountId) ? accountId : null);
  const updateMutation = useUpdateAccount();
  const lockMutation = useLockAccount();
  const unlockMutation = useUnlockAccount();
  const deleteMutation = useDeleteAccount();
  // The server refuses it too; an administrator is simply not offered locking or deleting their own account.
  const isSelf = useMe().data?.MaTaiKhoan === accountId;

  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<UpdateAccountPayload>();

  useEffect(() => {
    if (detailQuery.data) {
      reset({
        HoTen: detailQuery.data.HoTen,
        SoDienThoai: detailQuery.data.SoDienThoai,
        NgaySinh: detailQuery.data.NgaySinh?.slice(0, 10) ?? '',
        GioiTinh: detailQuery.data.GioiTinh ?? undefined,
        Email: detailQuery.data.Email,
        TenDangNhap: detailQuery.data.TenDangNhap,
      });
    }
  }, [detailQuery.data, reset]);

  if (detailQuery.isLoading) {
    return <PageSpinner />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div role="alert" className="mx-auto max-w-md rounded-lg bg-danger-light px-4 py-3 text-center text-sm text-danger-ink border border-danger/30">
        {detailQuery.error instanceof ApiError ? detailQuery.error.message : 'Không tìm thấy tài khoản'}
      </div>
    );
  }

  const account = detailQuery.data;
  const isLocked = account.TrangThai === 'Khóa';

  const onSubmit = (data: UpdateAccountPayload) =>
    updateMutation.mutate({
      id: accountId,
      payload: {
        ...data,
        NgaySinh: data.NgaySinh || undefined,
        GioiTinh: data.GioiTinh ? data.GioiTinh : undefined,
      },
    });

  const onDelete = async () => {
    const accepted = await confirm({ title: 'Xóa tài khoản?', description: `Tài khoản ${account.HoTen} sẽ bị xóa nếu không có dữ liệu lịch sử cần giữ lại.`, confirmLabel: 'Xóa tài khoản', variant: 'danger' });
    if (!accepted) return;
    const result = await deleteMutation.mutateAsync(accountId);
    if (result.hardDeleted) navigate('/admin/accounts', { replace: true });
  };

  return (
    <div className="flex flex-col gap-6 max-w-[800px] mx-auto w-full">
      <Link to="/admin/accounts" className="breadcrumb w-fit">
        <i className="ph ph-arrow-left"></i>
        <span>Quay lại danh sách</span>
      </Link>

      <div className="bg-white border border-border rounded-[16px] shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-surface-secondary flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg uppercase">
              {account.HoTen.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-heading">{account.HoTen}</h3>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${isLocked ? 'bg-danger-light text-danger-ink border-danger/30' : 'bg-success-light text-success-ink border-success/30'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isLocked ? 'bg-danger' : 'bg-success'}`}></span>
                  {account.TrangThai}
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-0.5 font-mono">ID: #{account.MaTaiKhoan}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {updateMutation.isSuccess && (
            <div role="status" className="p-3 bg-success-light border border-success/30 rounded-xl text-success-ink text-sm font-medium">
              Cập nhật tài khoản thành công
            </div>
          )}
          {(updateMutation.isError || lockMutation.isError || unlockMutation.isError || deleteMutation.isError) && (
            <div role="alert" className="p-3 bg-danger-light border border-danger/30 rounded-xl text-danger-ink text-sm font-medium">
              {[updateMutation, lockMutation, unlockMutation, deleteMutation].map((m) => m.error).find((e) => e instanceof ApiError)?.message ?? 'Thao tác thất bại, vui lòng thử lại'}
            </div>
          )}
          {deleteMutation.isSuccess && !deleteMutation.data?.hardDeleted && (
             <div role="status" className="p-3 bg-warning-light border border-warning/30 rounded-xl text-warning-ink text-sm font-medium">
               Tài khoản có dữ liệu lịch sử liên quan nên đã được khóa thay vì xóa hoàn toàn.
             </div>
          )}

          <div className="bg-surface-secondary border border-border rounded-2xl p-5 space-y-3">
            <h4 className="font-bold text-ink-sub uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <i className="ph-fill ph-identification-card text-primary"></i> Thông tin định danh & Cấu hình
            </h4>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2" noValidate>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="admin-account-detail-TenDangNhap" className="text-xs font-semibold text-ink-sub block">Tên đăng nhập</label>
                  <input id="admin-account-detail-TenDangNhap" type="text" {...register('TenDangNhap')} className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="admin-account-detail-Email" className="text-xs font-semibold text-ink-sub block">Email</label>
                  <input id="admin-account-detail-Email" type="email" {...register('Email')} className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="admin-account-detail-HoTen" className="text-xs font-semibold text-ink-sub block">Họ và tên</label>
                  <input id="admin-account-detail-HoTen" type="text" {...register('HoTen')} className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="admin-account-detail-SoDienThoai" className="text-xs font-semibold text-ink-sub block">Số điện thoại</label>
                  <input id="admin-account-detail-SoDienThoai" type="tel" {...register('SoDienThoai')} className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="admin-account-detail-NgaySinh" className="text-xs font-semibold text-ink-sub block">Ngày sinh</label>
                  <DateField id="admin-account-detail-NgaySinh" type="date" {...register('NgaySinh')} className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="admin-account-detail-GioiTinh" className="text-xs font-semibold text-ink-sub block">Giới tính</label>
                  <Select id="admin-account-detail-GioiTinh" {...register('GioiTinh')} className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition">
                    <option value="">Không chọn</option>
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={!isDirty || updateMutation.isPending}>
                  {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                </Button>
              </div>
            </form>
          </div>

          <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
            <h4 className="font-bold text-ink-sub uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <i className="ph-fill ph-shield-warning text-warning"></i> Quản lý bảo mật & Trạng thái
            </h4>
            
            {isSelf && <p className="text-xs text-ink-muted">Đây là tài khoản của bạn: không thể tự khóa hoặc xóa chính mình.</p>}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              {isSelf ? null : isLocked ? (
                <Button
                  type="button"
                  onClick={() => unlockMutation.mutate(accountId)}
                  disabled={unlockMutation.isPending} variant="success-outline" className="flex-1"
                >
                  <i className="ph ph-lock-key-open"></i> {unlockMutation.isPending ? 'Đang mở khóa...' : 'Mở khóa tài khoản'}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    void confirm({ title: 'Khóa tài khoản?', description: 'Người dùng sẽ không thể đăng nhập cho đến khi được mở khóa.', confirmLabel: 'Khóa tài khoản', variant: 'danger' }).then((accepted) => { if (accepted) lockMutation.mutate(accountId); });
                  }}
                  disabled={lockMutation.isPending} variant="warning-outline" className="flex-1"
                >
                  <i className="ph ph-lock-key"></i> {lockMutation.isPending ? 'Đang khóa...' : 'Khóa tài khoản'}
                </Button>
              )}

              {!isSelf && (
                <Button type="button" onClick={onDelete} disabled={deleteMutation.isPending} variant="danger-outline" className="flex-1">
                  <i className="ph ph-trash" aria-hidden="true"></i> {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa tài khoản'}
                </Button>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
