import type { ReactNode } from 'react';
import { Icon } from './Icon';

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Tên biểu tượng Phosphor */
  icon?: string;
  action?: ReactNode;
}

/** Trạng thái danh sách rỗng */
export function EmptyState({ title, description, icon = 'tray', action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Icon name={icon} weight="duotone" />
      <p className="empty-state__title">{title}</p>
      {description && <p className="empty-state__desc">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
