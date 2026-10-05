import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useApplyPartner, useMyPartnerApplication } from '../../features/partners/hooks';
import { applyPartnerSchema, ApplyPartnerFormValues } from '../../features/partners/schemas';
import { ApiError } from '../../services/apiClient';
import { applyServerFieldErrors } from '../../lib/apiErrors';
import { refreshSession } from '../../services/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import { meQueryKey } from '../../features/auth/hooks';
import { cn } from '../../lib/utils';
import { PageSpinner } from '../../components/common/PageSpinner';
import { Button } from '../../components/common/Button';

const statusLabel: Record<string, { text: string; className: string }> = {
  'Chờ duyệt': { text: 'Đang chờ duyệt', className: 'text-warning-ink bg-warning-light border-warning/30' },
  'Đã duyệt': { text: 'Đã được duyệt', className: 'text-success-ink bg-success-light border-success/30' },
  'Từ chối': { text: 'Đã bị từ chối', className: 'text-danger-ink bg-danger-light border-danger/30' },
};

export default function PartnerApplyPage() {
  const applicationQuery = useMyPartnerApplication();
  const applyMutation = useApplyPartner();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ApplyPartnerFormValues>({ resolver: zodResolver(applyPartnerSchema) });

  const existing = applicationQuery.data;
  useEffect(() => {
    if (existing?.TrangThaiDuyet === 'Đã duyệt') {
      void refreshSession().then(() => queryClient.invalidateQueries({ queryKey: meQueryKey }));
    }
  }, [existing?.TrangThaiDuyet, queryClient]);

  if (applicationQuery.isLoading) {
    return <PageSpinner />;
  }
  const displayedApplication = applyMutation.data ?? existing;
  const hasActiveApplication = displayedApplication && displayedApplication.TrangThaiDuyet !== 'Từ chối';
  const displayedStatus = displayedApplication ? statusLabel[displayedApplication.TrangThaiDuyet] : undefined;

  const onSubmit = (data: ApplyPartnerFormValues) =>
    applyMutation.mutate(data, { onError: (error) => applyServerFieldErrors(error, setError, ['SoCCCD', 'SoGiayPhepKinhDoanh', 'MaSoThue', 'TepGiayTo']) });

  return (
    <div className="bg-surface-secondary text-ink font-sans antialiased min-h-[80vh] flex flex-col">
      <div className="flex-grow page-container max-w-[800px] py-8 md:py-12 flex flex-col gap-10">
        
        <section className="space-y-6">
          <div className="space-y-2 border-b border-border pb-6">
            <h1 className="text-2xl font-bold text-ink">Đăng ký đối tác</h1>
            <p className="text-ink-muted">
              Hoàn tất thông tin tài khoản, đơn vị kinh doanh để đăng ký trở thành đối tác của Egode.<br className="hidden md:block" />
              Sau khi gửi hồ sơ, hệ thống sẽ tiến hành xét duyệt trước khi cấp quyền quản lý khách sạn.
            </p>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-2xl border border-border shadow-sm">
            {displayedApplication && hasActiveApplication && displayedStatus ? (
              <div className="flex flex-col items-center text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-primary-50 mb-5 text-primary text-3xl">
                  {displayedApplication.TrangThaiDuyet === 'Đã duyệt' ? <i className="ph-fill ph-check-circle text-success"></i> : <i className="ph-fill ph-clock"></i>}
                </div>
                <h3 className="text-xl font-bold text-ink mb-2">Hồ sơ đã được gửi</h3>
                <div className="bg-surface-secondary rounded-xl p-4 w-full mb-4 border border-border flex justify-between items-center max-w-sm">
                  <span className="text-sm text-ink-muted">Trạng thái:</span>
                  <span className={cn("flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full border", displayedStatus.className)}>
                    {displayedApplication.TrangThaiDuyet === 'Chờ duyệt' && <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse"></span>}
                    {displayedStatus.text}
                  </span>
                </div>
                <p className="text-sm text-ink-muted mb-6">
                  {(displayedApplication.TrangThaiDuyet === 'Đã duyệt')
                    ? 'Bạn đã được cấp vai trò Chủ khách sạn. Bạn có thể bắt đầu đăng ký khách sạn.'
                    : 'Hồ sơ đối tác của bạn đã được ghi nhận và đang chờ quản trị viên xử lý.'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
                {existing?.TrangThaiDuyet === 'Từ chối' && (
                  <div role="alert" className="rounded-lg bg-danger-light px-4 py-3 text-sm text-danger-ink border border-danger/30">
                    Hồ sơ trước đó đã bị từ chối{existing.LyDoTuChoi ? `: ${existing.LyDoTuChoi}` : ''}. Bạn có thể nộp lại hồ sơ mới bên dưới.
                  </div>
                )}
                {applyMutation.isError && (
                  <div role="alert" className="rounded-lg bg-danger-light px-4 py-3 text-sm text-danger-ink border border-danger/30">
                    {applyMutation.error instanceof ApiError ? applyMutation.error.message : 'Nộp hồ sơ thất bại, vui lòng thử lại'}
                  </div>
                )}

                <h3 className="text-lg font-semibold text-ink mb-2">Thông tin người đăng ký</h3>
                <p className="text-sm text-ink-muted mb-6 flex items-center gap-1.5">
                  <i className="ph ph-info text-primary-500"></i> Thông tin này được sử dụng để xác minh người đăng ký đối tác.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                  <div>
                    <label htmlFor="partner-apply-field-1" className="form-label">Số CCCD / CMND <span className="text-danger">*</span></label>
                    <input id="partner-apply-field-1" 
                      type="text" 
                      placeholder="Nhập số CCCD" 
                      className={cn("input", errors.SoCCCD && "border-danger")}
                      {...register('SoCCCD')} 
                    />
                    {errors.SoCCCD && <p className="text-xs text-danger mt-1">{errors.SoCCCD.message}</p>}
                  </div>

                  <div>
                    <label htmlFor="partner-apply-field-2" className="form-label">Số giấy phép kinh doanh <span className="text-danger">*</span></label>
                    <input id="partner-apply-field-2" 
                      type="text" 
                      placeholder="Nhập số GPKD" 
                      className={cn("input", errors.SoGiayPhepKinhDoanh && "border-danger")}
                      {...register('SoGiayPhepKinhDoanh')} 
                    />
                    {errors.SoGiayPhepKinhDoanh && <p className="text-xs text-danger mt-1">{errors.SoGiayPhepKinhDoanh.message}</p>}
                  </div>

                  <div>
                    <label htmlFor="partner-apply-field-3" className="form-label">Mã số thuế <span className="text-danger">*</span></label>
                    <input id="partner-apply-field-3" 
                      type="text" 
                      placeholder="Nhập mã số thuế" 
                      className={cn("input", errors.MaSoThue && "border-danger")}
                      {...register('MaSoThue')} 
                    />
                    {errors.MaSoThue && <p className="text-xs text-danger mt-1">{errors.MaSoThue.message}</p>}
                  </div>
                  
                  <div>
                    <label htmlFor="partner-apply-field-4" className="form-label">Đường dẫn tệp giấy tờ <span className="text-danger">*</span></label>
                    <input id="partner-apply-field-4" 
                      type="text" 
                      placeholder="https://..." 
                      className={cn("input", errors.TepGiayTo && "border-danger")}
                      {...register('TepGiayTo')} 
                    />
                    {errors.TepGiayTo && <p className="text-xs text-danger mt-1">{errors.TepGiayTo.message}</p>}
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <label className="flex items-start gap-3 cursor-pointer group mb-6">
                    <div className="relative flex items-center justify-center w-5 h-5 mt-0.5">
                      <input type="checkbox" required className="peer appearance-none w-5 h-5 border border-border-strong rounded bg-white checked:bg-primary checked:border-primary transition-colors cursor-pointer" />
                      <i className="ph-bold ph-check absolute text-white text-xs opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity"></i>
                    </div>
                    <span className="text-sm text-ink group-hover:text-black transition-colors">Tôi xác nhận các thông tin cung cấp ở trên là hoàn toàn chính xác.</span>
                  </label>
                  
                  <Button type="submit" disabled={isSubmitting || applyMutation.isPending} size="lg" className="w-full">
                    {isSubmitting || applyMutation.isPending ? 'Đang gửi...' : 'Nộp hồ sơ đối tác'}
                  </Button>
                </div>

              </form>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
