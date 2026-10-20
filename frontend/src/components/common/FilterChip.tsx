import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface FilterChipProps {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** Nút bật tắt cho bộ lọc nhanh */
export function FilterChip({ pressed, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors',
        pressed ? 'border-primary bg-primary-50 text-primary-700' : 'border-border bg-surface text-ink-sub hover:bg-surface-secondary'
      )}
    >
      {children}
    </button>
  );
}
