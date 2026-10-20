import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useResetPassword, useSignOut } from '../../features/auth/hooks';
import { useAuthStore } from '../../lib/authStore';
import { resetPasswordSchema, ResetPasswordFormValues } from '../../features/auth/schemas';
import { ApiError } from '../../services/apiClient';
import { cn } from '../../lib/utils';
import { Button } from '../../components/common/Button';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const mutation = useResetPassword();
  // Cùng một liên kết email cho quên mật khẩu và đổi mật khẩu từ hồ sơ
  const isChangingPassword = useAuthStore((s) => !!s.accessToken);
  const { signOut } = useSignOut();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });

  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const onSubmit = async (data: ResetPasswordFormValues) => {
    try {
      await mutation.mutateAsync(data);
      // Mọi phiên đã bị vô hiệu nên xóa phiên cục bộ
      if (isChangingPassword) await signOut();
      navigate('/login', { replace: true });
    } catch {
      // Lỗi hiển thị qua mutation.isError bên dưới
    }
  };

  if (!token) {
    return (
      <div className="bg-surface-secondary min-h-[80vh] flex items-center justify-center font-sans">
        <div className="bg-white w-full max-w-[36.25rem] rounded-2xl shadow-lg border border-border p-6 sm:p-8 lg:p-10 text-center">
          <div className="inline-flex justify-center items-center w-16 h-16 rounded-full bg-danger-light text-danger mb-4 text-3xl">
            <i className="ph-fill ph-warning-circle"></i>
          </div>
          <h1 className="text-2xl font-bold text-ink mb-2">Liên kết không hợp lệ</h1>
          <p className="text-sm text-ink-muted mb-6">
            {isChangingPassword
              ? 'Thiếu token đổi mật khẩu. Vui lòng quay lại hồ sơ và bấm Đổi mật khẩu để nhận link mới.'
              : 'Thiếu token đặt lại mật khẩu. Vui lòng yêu cầu lại từ trang quên mật khẩu.'}
          </p>
          {isChangingPassword
            ? <Link to="/profile" className="text-sm font-semibold text-primary hover:underline">Quay lại hồ sơ</Link>
            : <Link to="/forgot-password" className="text-sm font-semibold text-primary hover:underline">Quên mật khẩu</Link>}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-secondary font-sans text-ink min-h-[80vh] flex flex-col antialiased">
      <div className="flex-grow flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="bg-white w-full max-w-[36.25rem] rounded-2xl shadow-lg border border-border p-6 sm:p-8 lg:p-10">
          
          {/* Các bước */}
          <div className="flex items-center justify-between mb-8 relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[1px] bg-border -z-10"></div>
            
            <div className="flex items-center gap-2 bg-white pr-2">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs">
                <i className="ph-bold ph-check text-sm"></i>
              </div>
              <span className="text-sm font-medium text-ink hidden sm:inline">{isChangingPassword ? '1. Yêu cầu đổi mật khẩu' : '1. Nhập email'}</span>
            </div>

            <div className="flex items-center gap-2 bg-white px-2">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs">
                <i className="ph-bold ph-check text-sm"></i>
              </div>
              <span className="text-sm font-medium text-ink hidden sm:inline">2. Kiểm tra email</span>
            </div>

            <div className="flex items-center gap-2 bg-white pl-2">
              <div className="w-6 h-6 rounded-full border-2 border-primary flex items-center justify-center text-primary font-bold text-xs">3</div>
              <span className="text-sm font-bold text-primary">3. Đặt mật khẩu mới</span>
            </div>
          </div>

          <div className="text-center mb-8">
            <div className="inline-flex justify-center items-center w-16 h-16 rounded-full bg-primary-50 mb-4 text-primary relative">
              <i className="ph-fill ph-key text-3xl"></i>
              <div className="absolute bottom-0 right-0 bg-white rounded-full">
                <i className="ph-fill ph-check-circle text-primary text-xl"></i>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-ink mb-2">{isChangingPassword ? 'Đổi mật khẩu' : 'Đặt mật khẩu mới'}</h1>
            <p className="text-sm text-ink-muted leading-relaxed max-w-md mx-auto">
              {isChangingPassword
                ? 'Email của bạn đã được xác nhận. Nhập mật khẩu mới; sau khi hoàn tất, bạn sẽ cần đăng nhập lại trên mọi thiết bị.'
                : 'Vui lòng nhập mật khẩu mới và xác nhận lại để hoàn tất việc đặt lại mật khẩu.'}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {mutation.isError && (
              <div role="alert" className="rounded-lg bg-danger-light px-4 py-3 text-sm text-danger-ink border border-danger/30">
                {mutation.error instanceof ApiError ? mutation.error.message : 'Token không hợp lệ hoặc đã hết hạn'}
              </div>
            )}
            
            <input type="hidden" {...register('token')} />

            <div className="space-y-1.5">
              <label htmlFor="reset-password-field-1" className="block text-sm font-medium text-ink">Mật khẩu mới</label>
              <div className="relative">
                <input id="reset-password-field-1" 
                  type={showPwd ? "text" : "password"} 
                  placeholder="••••••••••" 
                  className={cn("w-full px-4 py-2.5 rounded-lg border bg-white text-ink text-sm placeholder:text-ink-muted focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 transition-all", errors.MatKhauMoi ? "border-danger bg-danger-light/20" : "border-border")}
                  {...register('MatKhauMoi')}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-ink-muted hover:text-ink transition-colors focus:outline-none"
                >
                  <i className={cn("ph text-lg", showPwd ? "ph-eye" : "ph-eye-slash")}></i>
                </button>
              </div>
              {errors.MatKhauMoi && <p className="text-xs text-danger font-medium mt-1.5 flex items-center gap-1"><i className="ph-fill ph-warning-circle"></i>{errors.MatKhauMoi.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reset-password-field-2" className="block text-sm font-medium text-ink">Xác nhận mật khẩu mới</label>
              <div className="relative">
                <input id="reset-password-field-2" 
                  type={showConfirmPwd ? "text" : "password"} 
                  placeholder="••••••••••" 
                  className={cn("w-full px-4 py-2.5 rounded-lg border bg-white text-ink text-sm placeholder:text-ink-muted focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 transition-all", errors.confirmMatKhauMoi ? "border-danger bg-danger-light/20" : "border-border")}
                  {...register('confirmMatKhauMoi')}
                />
                <button 
                  type="button" 
                  onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-ink-muted hover:text-ink transition-colors focus:outline-none"
                >
                  <i className={cn("ph text-lg", showConfirmPwd ? "ph-eye" : "ph-eye-slash")}></i>
                </button>
              </div>
              {errors.confirmMatKhauMoi && <p className="text-xs text-danger font-medium mt-1.5 flex items-center gap-1"><i className="ph-fill ph-warning-circle"></i>{errors.confirmMatKhauMoi.message}</p>}
            </div>

            <Button 
              type="submit" 
              disabled={isSubmitting || mutation.isPending} size="lg" className="w-full mt-6"
            >
              {isSubmitting || mutation.isPending ? (
                 <>Đang xử lý... <div className="spinner w-4 h-4 border-2 border-white/20 border-t-white" aria-hidden="true"></div></>
              ) : (
                'Cập nhật mật khẩu'
              )}
            </Button>

            <div className="text-center mt-6">
              <Link to={isChangingPassword ? '/profile' : '/login'} className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
                <i className="ph-bold ph-arrow-left"></i>
                {isChangingPassword ? 'Quay lại hồ sơ' : 'Quay lại Đăng nhập'}
              </Link>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
