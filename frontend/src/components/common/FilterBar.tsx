import type { ReactNode } from 'react';
import { Button } from './Button';

export interface FilterBarProps {
  children: ReactNode;
  /** Hiện nút Xóa bộ lọc khi có hàm xử lý */
  onReset?: () => void;
}

/** Khung chứa các ô lọc của trang danh sách */
export function FilterBar({ children, onReset }: FilterBarProps) {
  return (
    <div role="search" className="surface-card flex flex-wrap items-end gap-3 p-4">
      {children}
      {onReset && <Button type="button" variant="ghost" size="sm" onClick={onReset}>Xóa bộ lọc</Button>}
    </div>
  );
}
