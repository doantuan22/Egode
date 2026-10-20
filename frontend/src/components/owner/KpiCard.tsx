import { cn } from '../../lib/utils';
import type { Change } from '../../features/analytics/kpi';
import { Card } from '../common/Card';

interface KpiCardProps {
  label: string;
  /** Đã định dạng */
  value: string;
  change?: Change | null;
  /** Ghi chú dưới số liệu */
  note?: string;
}

const TONE = { good: 'text-success-ink', bad: 'text-danger-ink', neutral: 'text-ink-muted' } as const;

/** Một chỉ số kèm thay đổi so với kỳ trước */
export function KpiCard({ label, value, change, note }: KpiCardProps) {
  return (
    <Card>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      {change ? <p className={cn('mt-1 text-xs font-medium', TONE[change.tone])}>{change.text}</p> : <p className="mt-1 text-xs text-ink-muted">Chưa có dữ liệu kỳ trước</p>}
      {note && <p className="mt-1 text-[11px] text-ink-muted">{note}</p>}
    </Card>
  );
}
