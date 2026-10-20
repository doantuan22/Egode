import { cn } from '../../lib/utils';

/** Biểu tượng tải ở giữa trang hoặc khu vực */
export function PageSpinner({ label = 'Đang tải...', className = 'py-16' }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex justify-center', className)} role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true"></div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
