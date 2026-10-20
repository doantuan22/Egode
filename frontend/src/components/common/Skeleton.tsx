import { cn } from '../../lib/utils';

/** Khối giữ chỗ nhấp nháy */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('h-4 animate-pulse rounded-sm bg-surface-tertiary', className)} />;
}
