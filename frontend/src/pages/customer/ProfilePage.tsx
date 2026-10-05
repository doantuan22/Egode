import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useMe, useUpdateProfile, useSignOut, useChangePassword } from '../../features/auth/hooks';
import { useAuthStore } from '../../lib/authStore';
import { ROLE_NAMES } from '../../lib/roles';
import { updateProfileSchema, UpdateProfileFormValues, changePasswordSchema, ChangePasswordFormValues } from '../../features/auth/schemas';
import { ApiError } from '../../services/apiClient';
import { applyServerFieldErrors } from '../../lib/apiErrors';

import { cn } from '../../lib/utils';
import { PageSpinner } from '../../components/common/PageSpinner';
import { Button } from '../../components/common/Button';

export default function ProfilePage() {
  const meQuery = useMe();
  const updateMutation = useUpdateProfile();
  const changePasswordMutation = useChangePassword();
  const navigate = useNavigate();
  const { signOut } = useSignOut();
  // The account menu (bookings, support, sign out) is the customer's; admins and owners are already inside their dashboard.
  const isCustomer = useAuthStore((state) => state.role) === ROLE_NAMES.CUSTOMER;

  const {
    register,
    handleSubmit,
    setError,
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

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    setError: setPasswordError,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors },
  } = useForm<ChangePasswordFormValues>({ resolver: zodResolver(changePasswordSchema) });

  const onChangePassword = (data: ChangePasswordFormValues) =>
    changePasswordMutation.mutate(
      { MatKhauCu: data.MatKhauCu, MatKhauMoi: data.MatKhauMoi },
      {
        onSuccess: () => resetPasswordForm(),
        onError: (error) => applyServerFieldErrors(error, setPasswordError, ['MatKhauCu', 'MatKhauMoi']),
      }
    );

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const onSubmit = (data: UpdateProfileFormValues) =>
    updateMutation.mutate(
      {
        HoTen: data.HoTen,
        SoDienThoai: data.SoDienThoai,
        NgaySinh: data.NgaySinh || undefined,
        GioiTinh: data.GioiTinh ? data.GioiTinh : undefined,
      },
      { onError: (error) => applyServerFieldErrors(error, setError, ['HoTen', 'SoDienThoai', 'NgaySinh', 'GioiTinh']) }
    );

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
                <div className="relative group cursor-pointer mb-4">
                  <div className="w-32 h-32 rounded-full border-4 border-white shadow-sm bg-primary-100 flex items-center justify-center text-primary text-4xl font-bold">
                    {meQuery.data?.HoTen?.charAt(0) || 'U'}
                  </div>
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <i className="ph-fill ph-camera text-white text-xl"></i>
                  </div>
                </div>
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

          <div className="bg-white rounded-xl border border-border shadow-sm p-6">
            <h3 className="font-bold text-lg text-ink">Đổi mật khẩu</h3>
            <p className="text-sm text-ink-muted mt-1 mb-4">Nhập mật khẩu hiện tại và mật khẩu mới. Sau khi đổi, các thiết bị khác sẽ phải đăng nhập lại.</p>

            {changePasswordMutation.isSuccess && (
              <div role="status" className="mb-4 rounded-lg bg-success-light px-4 py-3 text-sm text-success-ink border border-success/30">
                Đổi mật khẩu thành công.
              </div>
            )}
            {changePasswordMutation.isError && Object.keys(passwordErrors).length === 0 && (
              <div role="alert" className="mb-4 rounded-lg bg-danger-light px-4 py-3 text-sm text-danger-ink border border-danger/30">
                {changePasswordMutation.error instanceof ApiError ? changePasswordMutation.error.message : 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại sau.'}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit(onChangePassword)} noValidate className="grid grid-cols-1 gap-4 max-w-md">
              {(
                [
                  { name: 'MatKhauCu', label: 'Mật khẩu hiện tại', autoComplete: 'current-password' },
                  { name: 'MatKhauMoi', label: 'Mật khẩu mới', autoComplete: 'new-password' },
                  { name: 'confirmMatKhauMoi', label: 'Xác nhận mật khẩu mới', autoComplete: 'new-password' },
                ] as const
              ).map((field) => (
                <div key={field.name}>
                  <label htmlFor={`profile-${field.name}`} className="form-label">{field.label}</label>
                  <input
                    id={`profile-${field.name}`}
                    type="password"
                    autoComplete={field.autoComplete}
                    aria-invalid={Boolean(passwordErrors[field.name])}
                    aria-describedby={passwordErrors[field.name] ? `profile-${field.name}-error` : undefined}
                    className={cn('input', passwordErrors[field.name] && 'border-danger')}
                    {...registerPassword(field.name)}
                  />
                  {passwordErrors[field.name] && (
                    <p id={`profile-${field.name}-error`} className="text-xs text-danger mt-1">{passwordErrors[field.name]?.message}</p>
                  )}
                </div>
              ))}
              <div>
                <Button type="submit" disabled={changePasswordMutation.isPending}>
                  {changePasswordMutation.isPending ? 'Đang đổi...' : 'Đổi mật khẩu'}
                </Button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
