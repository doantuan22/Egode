import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useMe, useUpdateProfile, useSignOut } from '../../features/auth/hooks';
import { useAuthStore } from '../../lib/authStore';
import { ROLE_NAMES } from '../../lib/roles';
import { updateProfileSchema, UpdateProfileFormValues } from '../../features/auth/schemas';
import { ApiError } from '../../services/apiClient';

import { cn } from '../../lib/utils';
import { PageSpinner } from '../../components/common/PageSpinner';
import { Button } from '../../components/common/Button';

export default function ProfilePage() {
  const meQuery = useMe();
  const updateMutation = useUpdateProfile();
  const navigate = useNavigate();
  const { signOut } = useSignOut();
  // The account menu (bookings, support, sign out) is the customer's; admins and owners are already inside their dashboard.
  const isCustomer = useAuthStore((state) => state.role) === ROLE_NAMES.CUSTOMER;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateProfileFormValues>({ resolver: zodResolver(updateProfileSchema) });

  useEffect(() => {
    if (meQuery.data) {
      reset({
        HoTen: meQuery.data.HoTen,
        SoDienThoai: meQuery.data.SoDienThoai,
        NgaySinh: meQuery.data.NgaySinh?.slice(0, 10) ?? '',
        GioiTinh: meQuery.data.GioiTinh ?? '',
      });
    }
  }, [meQuery.data, reset]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const onSubmit = (data: UpdateProfileFormValues) =>
    updateMutation.mutate({
      HoTen: data.HoTen,
      SoDienThoai: data.SoDienThoai,
      NgaySinh: data.NgaySinh || undefined,
      GioiTinh: data.GioiTinh ? data.GioiTinh : undefined,
    });

  if (meQuery.isLoading) {
    return <PageSpinner />;
  }

  if (meQuery.isError) {
    return (
      <div role="alert" className="mx-auto max-w-md mt-8 rounded-lg bg-danger-light px-4 py-3 text-center text-sm text-danger-ink">
        {meQuery.error instanceof ApiError ? meQuery.error.message : 'Không thể tải thông tin cá nhân'}
      </div>
    );
  }

  return (
    <div className="bg-surface-secondary text-ink min-h-[80vh]">
      <div className="page-container py-8 flex flex-col md:flex-row gap-8">
        
        {isCustomer && (
        <aside className="w-full md:w-[250px] shrink-0 bg-white rounded-2xl border border-border shadow-sm p-4">
          <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-4 pl-3">Hồ sơ tài khoản</h2>
          <nav className="flex flex-col space-y-1">
            <Link to="/profile" className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary-50 text-primary font-semibold transition-colors">
              <i className="ph-fill ph-user w-5 text-center text-lg"></i>
              <span>Hồ sơ cá nhân</span>
            </Link>
            <Link to="/bookings" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-ink-muted hover:bg-surface-secondary hover:text-ink transition-colors">
              <i className="ph ph-calendar-check w-5 text-center text-lg"></i>
              <span>Đặt phòng của tôi</span>
            </Link>
            <Link to="/support" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-ink-muted hover:bg-surface-secondary hover:text-ink transition-colors">
              <i className="ph ph-chat-dots w-5 text-center text-lg"></i>
              <span>Hỗ trợ/Khiếu nại</span>
            </Link>
          </nav>

          <div className="h-px bg-border my-4 mx-3"></div>

          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-danger hover:bg-danger-light transition-colors font-medium">
            <i className="ph ph-sign-out w-5 text-center text-lg"></i>
            <span>Đăng xuất</span>
          </button>
        </aside>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-ink mb-6">Hồ sơ cá nhân</h1>

          <div className="bg-white rounded-xl border border-border shadow-sm p-6 lg:p-8 mb-6">
            <div className="flex flex-col lg:flex-row gap-10">
              
              <div className="flex flex-col items-center shrink-0 w-full lg:w-48">
                <h3 className="font-bold text-lg text-ink mb-1 text-center">{meQuery.data?.HoTen}</h3>
                <p className="text-[13px] text-ink-muted mb-3 text-center">{meQuery.data?.TenDangNhap}</p>
              </div>

              <div className="flex-1">
                {updateMutation.isSuccess && (
                  <div className="mb-4 rounded-lg bg-success-light px-4 py-3 text-sm text-success-ink border border-success/30">
                    Cập nhật thông tin thành công!
                  </div>
                )}
                {updateMutation.isError && (
                  <div role="alert" className="mb-4 rounded-lg bg-danger-light px-4 py-3 text-sm text-danger-ink border border-danger/30">
                    {updateMutation.error instanceof ApiError ? updateMutation.error.message : 'Cập nhật thất bại, vui lòng thử lại'}
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  
                  <div className="sm:col-span-2">
                    <label htmlFor="profile-field-1" className="block text-xs font-semibold text-ink mb-1.5">Họ và tên</label>
                    <input id="profile-field-1" 
                      type="text" 
                      className={cn("w-full px-3.5 py-2.5 rounded-xl border bg-white text-ink text-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 transition-all", errors.HoTen ? "border-danger bg-danger-light/20" : "border-border")}
                      {...register('HoTen')} 
                    />
                    {errors.HoTen && <p className="text-xs text-danger mt-1">{errors.HoTen.message}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="profile-field-2" className="block text-xs font-semibold text-ink mb-1.5">Email</label>
                    <input id="profile-field-2" 
                      type="email" 
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-secondary text-ink-muted text-sm cursor-not-allowed"
                      value={meQuery.data?.Email || ''} 
                      readOnly 
                      disabled
                    />
                  </div>

                  <div>
                    <label htmlFor="profile-field-3" className="block text-xs font-semibold text-ink mb-1.5">Số điện thoại</label>
                    <input id="profile-field-3" 
                      type="tel" 
                      className={cn("w-full px-3.5 py-2.5 rounded-xl border bg-white text-ink text-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 transition-all", errors.SoDienThoai ? "border-danger bg-danger-light/20" : "border-border")}
                      {...register('SoDienThoai')} 
                    />
                    {errors.SoDienThoai && <p className="text-xs text-danger mt-1">{errors.SoDienThoai.message}</p>}
                  </div>

                  <div>
                    <label htmlFor="profile-field-4" className="block text-xs font-semibold text-ink mb-1.5">Ngày sinh</label>
                    <input id="profile-field-4" 
                      type="date" 
                      className={cn("w-full px-3.5 py-2.5 rounded-xl border bg-white text-ink text-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 transition-all", errors.NgaySinh ? "border-danger bg-danger-light/20" : "border-border")}
                      {...register('NgaySinh')} 
                    />
                  </div>

                  <div>
                    <label htmlFor="profile-field-5" className="block text-xs font-semibold text-ink mb-1.5">Giới tính</label>
                    <select id="profile-field-5" 
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-white text-ink text-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 transition-all"
                      {...register('GioiTinh')}
                    >
                      <option value="">Không chọn</option>
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 flex items-center gap-3 mt-4">
                    <Button type="submit" disabled={!isDirty || updateMutation.isPending}>
                      {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </Button>
                    <Button type="button" onClick={() => reset()} disabled={!isDirty} variant="secondary">
                      Hủy
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-border shadow-sm p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg text-ink">Bảo mật tài khoản</h3>
              <p className="text-sm text-ink-muted mt-1">Cập nhật mật khẩu để bảo vệ tài khoản của bạn.</p>
            </div>
            <Link to="/reset-password" className="px-5 py-2.5 border border-border rounded-xl text-sm font-semibold text-ink hover:bg-surface-secondary transition-colors shrink-0 shadow-sm">
              Đổi mật khẩu
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
