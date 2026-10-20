import { cn } from '../../lib/utils';

export interface BarListItem {
  label: string;
  value: number;
  /** Lớp màu nền của thanh, mặc định là màu chính */
  colorClass?: string;
  formattedValue?: string;
}

interface BarListProps {
  items: BarListItem[];
  emptyMessage?: string;
}

export function BarList({ items, emptyMessage = 'Chưa có dữ liệu' }: BarListProps) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-muted">{emptyMessage}</p>;
  }

  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-ink-sub">{item.label}</span>
            <span className="text-ink">{item.formattedValue ?? item.value.toLocaleString('vi-VN')}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-surface-tertiary">
            <div
              className={cn('h-2 rounded-full', item.colorClass ?? 'bg-primary')}
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
