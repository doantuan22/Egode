import { useEffect, useId, useRef, useState } from 'react';
import { QuantityStepper } from './QuantityStepper';

/** Hiện chỉ gửi một tổng số khách */
export function GuestPicker({ value, onChange, min = 1, max = 50, label = 'Số khách', open: controlledOpen, onOpenChange, variant = 'field' }: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: 'field' | 'segment' | 'panel';
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean | ((current: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(open) : next;
    if (controlledOpen === undefined) setInternalOpen(value);
    onOpenChange?.(value);
  };
  const closeRef = useRef<() => void>(() => {});
  closeRef.current = () => {
    if (controlledOpen === undefined) setInternalOpen(false);
    onOpenChange?.(false);
  };
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>('.quantity-stepper__button:not(:disabled)')?.focus());
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeRef.current();
        triggerRef.current?.focus();
      }
    };
    if (controlledOpen === undefined) {
      document.addEventListener('pointerdown', onPointerDown);
      document.addEventListener('keydown', onKeyDown);
    }
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, controlledOpen]);

  return (
    <div className="guest-picker" ref={rootRef}>
      {variant !== 'panel' && <>
        {variant === 'field' && <label className="ui-field-label" htmlFor={`${popoverId}-trigger`}>{label}</label>}
        <button ref={triggerRef} id={`${popoverId}-trigger`} type="button" className={`guest-picker__trigger ${variant === 'segment' ? 'guest-picker__trigger--segment' : ''}`} aria-label={`${label}, ${value} khách`} aria-haspopup="dialog" aria-expanded={open} aria-controls={popoverId} onClick={() => setOpen((current) => !current)}>
          {variant === 'segment' && <span className="guest-picker__segment-label">{label}</span>}
          <span>{value} khách</span><span aria-hidden="true">⌄</span>
        </button>
      </>}
      {open && <div id={popoverId} className="guest-picker__popover" role={variant === 'panel' ? 'group' : 'dialog'} aria-label="Chọn số khách">
        <div className="guest-picker__row"><div><strong>Khách</strong><span>Người lưu trú</span></div><QuantityStepper label="khách" value={value} min={min} max={max} onChange={onChange} /></div>
        {variant !== 'panel' && <button type="button" className="guest-picker__done" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}>Xong</button>}
      </div>}
    </div>
  );
}
