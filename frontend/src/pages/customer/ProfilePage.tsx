import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMe, useUpdateProfile, useChangePassword, useSignOut } from '../../features/auth/hooks';
import { updateProfileSchema, UpdateProfileFormValues, changePasswordSchema, ChangePasswordFormValues } from '../../features/auth/schemas';
import { ApiError } from '../../services/apiClient';
import { applyServerFieldErrors } from '../../lib/apiErrors';
import { useAuthStore } from '../../lib/authStore';
import { ROLE_NAMES } from '../../lib/roles';

import { cn } from '../../lib/utils';
import { PageSpinner } from '../../components/common/PageSpinner';
import { Button } from '../../components/common/Button';

/** Both sections of the customer's profile live in a frame of this height (the personal-details card sets it), so switching sections never resizes it. */
const CARD_MIN_HEIGHT = 'lg:min-h-[28rem]';

const PASSWORD_FIELDS = [
  { name: 'MatKhauCu', label: 'Mật khẩu hiện tại', autoComplete: 'current-password' },
  { name: 'MatKhauMoi', label: 'Mật khẩu mới', autoComplete: 'new-password' },
  { name: 'confirmMatKhauMoi', label: 'Xác nhận mật khẩu mới', autoComplete: 'new-password' },
] as const;

export default function ProfilePage() {
  const meQuery = useMe();
  const updateMutation = useUpdateProfile();
  const changePasswordMutation = useChangePassword();
  const navigate = useNavigate();
  const { signOut, isPending: isSigningOut } = useSignOut();
  const isCustomer = useAuthStore((state) => state.role) === ROLE_NAMES.CUSTOMER;
  // Which part of the customer's profile is open lives in the link (?muc=mat-khau), so it can be bookmarked and survives a reload.
  const section = useSearchParams()[0].get('muc') === 'mat-khau' ? 'password' : 'profile';

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
    watch: watchPassword,
    setError: setPasswordError,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors },
  } = useForm<ChangePasswordFormValues>({ resolver: zodResolver(changePasswordSchema) });

  const [shownPasswords, setShownPasswords] = useState<Record<(typeof PASSWORD_FIELDS)[number]['name'], boolean>>({ MatKhauCu: false, MatKhauMoi: false, confirmMatKhauMoi: false });
  // The same rules the server enforces, shown as the customer types: 8+ characters, not the current password, confirmation matches.
  const [typedCurrent = '', typedNew = '', typedConfirm = ''] = watchPassword(['MatKhauCu', 'MatKhauMoi', 'confirmMatKhauMoi']);
  const passwordChecks = [
    { label: 'Ít nhất 8 ký tự', met: typedNew.length >= 8 },
    { label: 'Khác mật khẩu hiện tại', met: typedNew.length > 0 && typedCurrent.length > 0 && typedNew !== typedCurrent },
    { label: 'Mật khẩu xác nhận khớp', met: typedConfirm.length > 0 && typedConfirm === typedNew },
  ];

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

  const profileCard = (
          <div className={cn('bg-white rounded-xl border border-border shadow-sm p-6 lg:p-8', CARD_MIN_HEIGHT)}>
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
  );

  // The content is centred in the frame, with roomier fields, so the card looks designed for its size rather than stretched.
  const passwordCard = (
    <div className={cn('bg-white rounded-xl border border-border shadow-sm p-6 lg:flex lg:p-8', CARD_MIN_HEIGHT)}>
      <div className="flex w-full flex-col gap-10 lg:flex-row lg:items-center">
        <div className="flex flex-col items-center shrink-0 w-full lg:w-48 text-center">
          <div className="w-32 h-32 rounded-full border-4 border-white shadow-sm bg-primary-100 flex items-center justify-center text-primary mb-4">
            <i className="ph-fill ph-lock-key text-5xl" aria-hidden="true"></i>
          </div>
          <h3 className="font-bold text-lg text-ink mb-1">Đổi mật khẩu</h3>
          <p className="text-[13px] leading-relaxed text-ink-muted">Sau khi đổi, các thiết bị khác sẽ phải đăng nhập lại.</p>
        </div>

        <div className="flex-1 min-w-0">
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

          <form onSubmit={handlePasswordSubmit(onChangePassword)} noValidate className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            {PASSWORD_FIELDS.map((field) => {
              const visible = shownPasswords[field.name];
              return (
                <div key={field.name} className={field.name === 'MatKhauCu' ? 'sm:col-span-2' : undefined}>
                  <label htmlFor={`profile-${field.name}`} className="block text-xs font-semibold text-ink mb-1.5">{field.label}</label>
                  <div className="relative">
                    <input
                      id={`profile-${field.name}`}
                      type={visible ? 'text' : 'password'}
                      autoComplete={field.autoComplete}
                      aria-invalid={Boolean(passwordErrors[field.name])}
                      aria-describedby={passwordErrors[field.name] ? `profile-${field.name}-error` : undefined}
                      className={cn(
                        'w-full py-3 pl-3.5 pr-11 rounded-xl border bg-white text-ink text-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 transition-all',
                        passwordErrors[field.name] ? 'border-danger bg-danger-light/20' : 'border-border'
                      )}
                      {...registerPassword(field.name)}
                    />
                    <button
                      type="button"
                      onClick={() => setShownPasswords((current) => ({ ...current, [field.name]: !current[field.name] }))}
                      aria-label={`${visible ? 'Ẩn' : 'Hiện'} ${field.label.toLowerCase()}`}
                      aria-pressed={visible}
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-muted transition-colors hover:text-ink"
                    >
                      <i className={cn('ph text-lg', visible ? 'ph-eye' : 'ph-eye-slash')} aria-hidden="true"></i>
                    </button>
                  </div>
                  {passwordErrors[field.name] && (
                    <p id={`profile-${field.name}-error`} className="text-xs text-danger mt-1">{passwordErrors[field.name]?.message}</p>
                  )}
                </div>
              );
            })}

            <ul className="sm:col-span-2 grid gap-2 rounded-xl bg-surface-secondary px-4 py-4 text-[13px]" aria-label="Yêu cầu mật khẩu">
              {passwordChecks.map((check) => (
                <li key={check.label} className={cn('flex items-center gap-2', check.met ? 'text-success-ink' : 'text-ink-muted')}>
                  <i className={cn('text-base', check.met ? 'ph-fill ph-check-circle' : 'ph ph-circle')} aria-hidden="true"></i>
                  <span>{check.label}<span className="sr-only">{check.met ? ' (đã đạt)' : ' (chưa đạt)'}</span></span>
                </li>
              ))}
            </ul>

            <div className="sm:col-span-2 mt-1 flex items-center gap-3">
              <Button type="submit" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? 'Đang đổi...' : 'Đổi mật khẩu'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  // A customer gets a side menu (profile / password / sign out); admins and owners are already inside their dashboard
  // and see both sections stacked.
  if (!isCustomer) {
    return (
      <div className="bg-surface-secondary text-ink min-h-[80vh]">
        <div className="page-container py-8">
          <div className="mx-auto flex w-full max-w-[900px] min-w-0 flex-col gap-6">
            <h1 className="text-2xl font-bold text-ink">HỒ SƠ CÁ NHÂN</h1>
            {profileCard}
            {passwordCard}
          </div>
        </div>
      </div>
    );
  }

  const menuItem = (active: boolean) =>
    cn(
      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
      active ? 'bg-primary-50 font-semibold text-primary' : 'text-ink-muted hover:bg-surface-secondary hover:text-ink'
    );

  return (
    <div className="bg-surface-secondary text-ink min-h-[80vh]">
      {/* On a wide screen the frame starts 15% of the window height down, so a short card does not hug the top of an empty page. */}
      <div className="page-container flex flex-col gap-6 pb-8 pt-8 md:flex-row md:pt-[15vh]">
        <aside className="w-full shrink-0 rounded-2xl border border-border bg-white p-4 shadow-sm md:w-[250px]">
          <h2 className="px-3 pb-4 text-xs font-semibold uppercase tracking-wider text-ink-muted">Hồ sơ tài khoản</h2>
          <nav aria-label="Hồ sơ tài khoản" className="flex flex-col gap-2">
            <Link to="/profile" aria-current={section === 'profile' ? 'page' : undefined} className={menuItem(section === 'profile')}>
              <i className={cn(section === 'profile' ? 'ph-fill' : 'ph', 'ph-user w-5 text-center text-lg')} aria-hidden="true"></i>
              <span>Hồ sơ cá nhân</span>
            </Link>
            <Link to="/profile?muc=mat-khau" aria-current={section === 'password' ? 'page' : undefined} className={menuItem(section === 'password')}>
              <i className={cn(section === 'password' ? 'ph-fill' : 'ph', 'ph-lock-key w-5 text-center text-lg')} aria-hidden="true"></i>
              <span>Đổi mật khẩu</span>
            </Link>
          </nav>

          <div className="mx-3 my-5 h-px bg-border"></div>

          <button type="button" onClick={handleLogout} disabled={isSigningOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-danger transition-colors hover:bg-danger-light">
            <i className="ph ph-sign-out w-5 text-center text-lg" aria-hidden="true"></i>
            <span>{isSigningOut ? 'Đang thoát...' : 'Đăng xuất'}</span>
          </button>
        </aside>

        {/* The side menu already names the section, so the heading is for screen readers only. The card fills the column,
            which makes the side menu exactly as tall as the card next to it. */}
        <div className="flex min-w-0 flex-1 flex-col [&>:last-child]:flex-1">
          <h1 className="sr-only">{section === 'profile' ? 'Hồ sơ cá nhân' : 'Đổi mật khẩu'}</h1>
          {section === 'profile' ? profileCard : passwordCard}
        </div>
      </div>
    </div>
  );
}
