import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Icon } from '../common/Icon';

export type ResultTone = 'success' | 'pending' | 'error';

const TONE = {
  success: { icon: 'check-circle', circle: 'bg-success-light text-success-ink' },
  pending: { icon: 'hourglass-medium', circle: 'bg-primary-50 text-primary' },
  error: { icon: 'x-circle', circle: 'bg-danger-light text-danger-ink' },
} as const;

interface ResultBannerProps {
  tone: ResultTone;
  /** Tiêu đề h1 của trang */
  title: string;
  description?: ReactNode;
  /** Nội dung thêm giữa mô tả và các nút */
  children?: ReactNode;
  /** Nút chính đứng đầu, các nút phụ theo sau */
  actions?: ReactNode;
}

/** Kết quả thanh toán gồm biểu tượng, tiêu đề, giải thích và bước tiếp theo */
export function ResultBanner({ tone, title, description, children, actions }: ResultBannerProps) {
  const { icon, circle } = TONE[tone];
  return (
    <div role={tone === 'error' ? undefined : 'status'} className="surface-card w-full max-w-2xl p-8 text-center md:p-12">
      <div className={cn('mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full text-3xl', circle)}>
        <Icon name={icon} weight="fill" />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-heading">{title}</h1>
      {description && <div className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-muted">{description}</div>}
      {children}
      {actions && <div className="flex flex-col justify-center gap-3 sm:flex-row">{actions}</div>}
    </div>
  );
}
