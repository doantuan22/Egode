import type { ReactNode } from 'react';
import { Button } from '../common/Button';
import { Icon } from '../common/Icon';

interface AdminListPanelProps {
  filters?: ReactNode;
  total?: number;
  itemLabel: string;
  activeFilterCount?: number;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: ReactNode;
}

/**
 * Admin-only list surface: filters + result summary + refresh + table.
 * Keeps list pages compact and predictable without changing public/customer UI.
 */
export function AdminListPanel({
  filters,
  total,
  itemLabel,
  activeFilterCount = 0,
  onRefresh,
  refreshing = false,
  children,
}: AdminListPanelProps) {
  return (
    <section className="admin-list-panel" aria-label={`Danh sách ${itemLabel}`}>
      {filters && <div className="admin-list-panel__filters">{filters}</div>}

      <div className="admin-list-panel__toolbar">
        <div className="admin-list-panel__summary" aria-live="polite">
          <strong>{typeof total === 'number' ? total.toLocaleString('vi-VN') : '—'}</strong>
          <span>{itemLabel}</span>
          {activeFilterCount > 0 && (
            <span className="admin-list-panel__filter-count">
              {activeFilterCount} bộ lọc đang áp dụng
            </span>
          )}
        </div>

        {onRefresh && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            loading={refreshing}
            className="admin-list-panel__refresh"
          >
            <Icon name="arrows-clockwise" size={16} />
            <span>Làm mới</span>
          </Button>
        )}
      </div>

      <div className="admin-list-panel__table">{children}</div>
    </section>
  );
}
