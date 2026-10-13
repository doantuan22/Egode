import { useId, useRef, useState, type FocusEvent } from 'react';
import { useAvailablePromotions } from '../../../features/promotions/hooks';
import type { AvailablePromotion } from '../../../features/promotions/types';
import { cn, formatCurrencyVND, formatDateVi } from '../../../lib/utils';
import { Button } from '../../common/Button';
import { Icon } from '../../common/Icon';
import { Input } from '../../common/Input';

const PERCENT = 'Phần trăm';

const describeDiscount = (promo: AvailablePromotion): string => {
  if (promo.LoaiGiamGia !== PERCENT) return `Giảm ${formatCurrencyVND(promo.GiaTriGiam)}`;
  return promo.MucGiamToiDa > 0
    ? `Giảm ${promo.GiaTriGiam}% (tối đa ${formatCurrencyVND(promo.MucGiamToiDa)})`
    : `Giảm ${promo.GiaTriGiam}%`;
};

/**
 * The "Mã khuyến mãi" box. Clicking or focusing it opens a panel with the codes the guest can use right now —
 * the server only lists codes whose date window contains today and that still have uses left — and picking
 * one applies it. Typing a code by hand keeps working. A listed code whose minimum order is not reached yet
 * is shown (so the guest knows what to aim for) but cannot be picked.
 */
export function PromoPicker({ value, onChange, onApply, applyDisabled, onSelect, appliedCode, subtotal }: {
  value: string;
  onChange: (value: string) => void;
  /** "Áp dụng": apply what is typed in the box. */
  onApply: () => void;
  applyDisabled: boolean;
  /** Called with the chosen code; the page applies it. */
  onSelect: (code: string) => void;
  /** The code the current quote was priced with, marked in the list. */
  appliedCode: string;
  /** Room total before any discount, to tell whether a code's minimum order is met. */
  subtotal: number;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const promotions = useAvailablePromotions();

  const close = () => setOpen(false);
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!wrapperRef.current?.contains(event.relatedTarget as Node | null)) close();
  };
  const pick = (promo: AvailablePromotion) => {
    onSelect(promo.MaCode);
    close();
  };

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onBlur={onBlur}
      onKeyDown={(event) => { if (event.key === 'Escape' && open) { event.stopPropagation(); close(); } }}
    >
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            id="hotel-detail-ml-1"
            label="Mã khuyến mãi"
            type="text"
            autoComplete="off"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            placeholder="Nhập hoặc chọn mã"
            className="uppercase"
            aria-haspopup="true"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
          />
        </div>
        <Button type="button" variant="secondary" onClick={onApply} disabled={applyDisabled}>Áp dụng</Button>
      </div>

      {open && (
        <div
          id={listId}
          role="group"
          aria-label="Mã khuyến mãi có thể dùng"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-white p-2 shadow-lg"
        >
          {promotions.isLoading ? (
            <p role="status" className="px-2 py-3 text-xs text-ink-muted">Đang tải mã khuyến mãi...</p>
          ) : promotions.isError ? (
            <p role="alert" className="px-2 py-3 text-xs text-danger-ink">Không tải được danh sách mã. Bạn vẫn có thể nhập mã thủ công.</p>
          ) : !promotions.data || promotions.data.length === 0 ? (
            <p className="px-2 py-3 text-xs text-ink-muted">Hiện chưa có mã khuyến mãi nào có thể áp dụng.</p>
          ) : (
            <ul className="space-y-1.5">
              {/* Codes that can be picked now come first; the locked ones stay below as something to aim for. */}
              {[...promotions.data].sort((a, b) => Number(a.GiaTriDonToiThieu > subtotal) - Number(b.GiaTriDonToiThieu > subtotal)).map((promo) => {
                const missing = promo.GiaTriDonToiThieu - subtotal;
                const eligible = missing <= 0;
                const isApplied = appliedCode !== '' && appliedCode.toUpperCase() === promo.MaCode.toUpperCase();
                return (
                  <li key={promo.MaCode}>
                    <button
                      type="button"
                      disabled={!eligible}
                      onClick={() => pick(promo)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition',
                        eligible ? 'border-border hover:border-primary hover:bg-primary-50' : 'cursor-not-allowed border-dashed border-border bg-surface-secondary opacity-70',
                        isApplied && 'border-primary bg-primary-50'
                      )}
                    >
                      <span className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-lg bg-primary-100 text-primary">
                        <Icon name={isApplied ? 'check-circle' : 'ticket'} weight="fill" size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2">
                          <span className="font-mono text-sm font-bold text-ink">{promo.MaCode}</span>
                          {isApplied && <span className="text-[0.6875rem] font-semibold text-primary">Đang áp dụng</span>}
                        </span>
                        <span className="block text-xs font-semibold text-success-ink">{describeDiscount(promo)}</span>
                        <span className="block text-xs text-ink-muted">
                          {promo.GiaTriDonToiThieu > 0 ? `Đơn từ ${formatCurrencyVND(promo.GiaTriDonToiThieu)} · ` : ''}
                          Dùng đến {formatDateVi(promo.NgayKetThuc)}
                        </span>
                        {!eligible && (
                          <span className="mt-0.5 block text-xs font-medium text-warning-ink">
                            Cần thêm {formatCurrencyVND(missing)} để dùng mã này
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
