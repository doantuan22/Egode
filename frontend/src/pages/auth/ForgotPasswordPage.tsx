import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { useForgotPassword } from '../../features/auth/hooks';
import { forgotPasswordSchema, ForgotPasswordFormValues } from '../../features/auth/schemas';
import { ApiError } from '../../services/apiClient';
import { cn } from '../../lib/utils';
import { Button } from '../../components/common/Button';

export default function ForgotPasswordPage() {
  const mutation = useForgotPassword();
  const { error: mutationError } = mutation;
  const isRateLimited = mutationError instanceof ApiError && mutationError.statusCode === 429;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = (data: ForgotPasswordFormValues) => mutation.mutate(data);
  const email = watch('Email');

  return (
    <div className="bg-surface-secondary font-sans text-ink min-h-[80vh] flex flex-col antialiased">
      
      <div className="flex-grow flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="bg-white w-full max-w-[36.25rem] rounded-2xl shadow-lg border border-border p-6 sm:p-8 lg:p-10">
          
          {/* Stepper */}
          <div className="flex items-center justify-between mb-8 relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[1px] bg-border -z-10"></div>
            
            <div className="flex items-center gap-2 bg-white pr-2">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs">
                {mutation.isSuccess ? <i className="ph-bold ph-check text-sm"></i> : "1"}
              </div>
              <span className={cn("text-sm font-bold", !mutation.isSuccess ? "text-primary" : "text-ink hidden sm:inline")}>1. Nhập email</span>
            </div>

            <div className="flex items-center gap-2 bg-white px-2">
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border-2", mutation.isSuccess ? "bg-primary border-primary text-white" : "border-border-strong text-ink-muted")}>
                2
              </div>
              <span className={cn("text-sm font-medium hidden sm:inline", mutation.isSuccess ? "text-primary font-bold" : "text-ink-muted")}>2. Kiểm tra email</span>
            </div>

            <div className="flex items-center gap-2 bg-white pl-2">
              <div className="w-6 h-6 rounded-full border-2 border-border-strong flex items-center justify-center text-ink-muted font-bold text-xs">
                3
              </div>
              <span className="text-sm font-medium text-ink-muted hidden sm:inline">3. Đặt mật khẩu mới</span>
            </div>
          </div>

          {mutation.isSuccess ? (
            <div className="bg-success-light border border-success/30 rounded-xl p-5 flex gap-4 mb-8">
              <div className="flex-shrink-0 mt-0.5">
                <i className="ph-fill ph-check-circle text-success text-2xl"></i>
              </div>
              <p className="text-sm text-success-ink leading-relaxed">
                Một hướng dẫn đặt lại mật khẩu đã được gửi đến địa chỉ email: <br/>
                <span className="font-bold text-success-ink">{email}</span>. Vui lòng kiểm tra hộp thư đến (và thư rác).
              </p>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex justify-center items-center w-16 h-16 rounded-full bg-primary-50 mb-4 text-primary">
                  <i className="ph-duotone ph-envelope-simple-open text-3xl"></i>
                </div>
                <h1 className="text-2xl font-bold text-ink mb-2">Quên mật khẩu?</h1>
                <p className="text-sm text-ink-muted leading-relaxed max-w-md mx-auto">
                  Vui lòng nhập địa chỉ email bạn đã sử dụng để đăng ký tài khoản. Chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu cho bạn.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                {mutation.isError && (
                  <div className="rounded-lg bg-danger-light px-4 py-3 text-sm text-danger-ink border border-danger/30" role="alert">
                    {isRateLimited
                      ? 'Bạn đã thử quá nhiều lần trong 1 giờ. Vui lòng chờ rồi thử lại sau.'
                      : 'Có lỗi xảy ra, vui lòng kiểm tra lại email hoặc thử lại sau.'}
                  </div>
                )}
                
                <div className="space-y-1.5">
                  <label htmlFor="Email" className="block text-sm font-semibold text-ink">Địa chỉ Email</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-muted">
                      <i className="ph ph-envelope-simple text-lg"></i>
                    </div>
                    <input 
                      type="email" 
                      id="Email" 
                      placeholder="name@example.com"
                      className={cn("w-full pl-10 pr-4 py-3 rounded-xl border bg-white text-ink text-sm placeholder:text-ink-muted focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 transition-all", errors.Email ? "border-danger bg-danger-light/20" : "border-border")}
                      {...register('Email')}
                    />
                  </div>
                  {errors.Email && <p className="text-xs text-danger font-medium mt-1.5 flex items-center gap-1"><i className="ph-fill ph-warning-circle"></i>{errors.Email.message}</p>}
                </div>

                <Button 
                  type="submit" 
                  disabled={isSubmitting || mutation.isPending} size="lg" className="w-full mt-6"
                >
                  {isSubmitting || mutation.isPending ? (
                     <>Đang gửi... <div className="spinner w-4 h-4 border-2 border-white/20 border-t-white" aria-hidden="true"></div></>
                  ) : (
                    'Gửi hướng dẫn qua email'
                  )}
                </Button>

                <div className="text-center mt-6">
                  <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-primary font-bold hover:underline">
                    <i className="ph-bold ph-arrow-left"></i>
                    Quay lại Đăng nhập
                  </Link>
                </div>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
