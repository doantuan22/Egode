import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Khoảng đệm bên trong */
  padded?: boolean;
  /** Bề mặt nổi duy nhất của trang */
  raised?: boolean;
}

/** Khung nội dung có viền */
export function Card({ padded = true, raised = false, className, ...props }: CardProps) {
  return <div className={cn('surface-card', raised && 'surface-card--raised', padded && 'p-5', className)} {...props} />;
}
