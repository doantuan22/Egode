const buttonClass =
  'px-3 py-1.5 rounded-lg border border-border bg-white text-ink-sub hover:bg-surface-secondary disabled:opacity-40 disabled:hover:bg-white text-xs font-medium transition';

/** Chân danh sách phân trang kèm nút trước và sau */
export function Pagination({ page, totalPages, total, itemLabel, onPageChange }: {
  page: number;
  totalPages: number;
  total: number;
  /** Tên đối tượng được đếm */
  itemLabel: string;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav aria-label="Phân trang" className="px-6 py-4 border-t border-border bg-surface-secondary/50 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="text-xs text-ink-muted">
        Trang <strong className="text-heading">{page}</strong> / {totalPages} — Tổng <strong className="text-heading">{total}</strong> {itemLabel}
      </div>
      <div className="flex gap-1.5">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className={buttonClass}>Trước</button>
        <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className={buttonClass}>Sau</button>
      </div>
    </nav>
  );
}
