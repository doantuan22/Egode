import { forwardRef, useCallback, useLayoutEffect, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker, type Matcher } from 'react-day-picker';
import { vi } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { cn, fromDateInputValue, toDateInputValue } from '../../lib/utils';
import { useAnchoredPosition } from './useAnchoredPosition';

// Nhận type để thay input date mà không đổi props
type DateFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  type?: string;
  /** Thêm chọn tháng và năm cho ngày xa hôm nay */
  captionLayout?: 'label' | 'dropdown';
};

const POPOVER_WIDTH = 330;

const setNativeValue = (input: HTMLInputElement, value: string) => {
  // Dùng setter của prototype để React nhận thay đổi
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

/** Ô ngày dùng lịch của ứng dụng thay cho lịch của trình duyệt */
export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(function DateField(props, forwardedRef) {
  return <EnhancedDateField ref={forwardedRef} {...props} />;
});

const EnhancedDateField = forwardRef<HTMLInputElement, DateFieldProps>(function EnhancedDateField(
  { className, onChange, value, defaultValue, min, max, disabled, captionLayout = 'label', ...rest },
  forwardedRef
) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(defaultValue === undefined ? '' : String(defaultValue));
  const current = value === undefined ? typed : String(value);

  const setRefs = useCallback(
    (element: HTMLInputElement | null) => {
      inputRef.current = element;
      if (typeof forwardedRef === 'function') forwardedRef(element);
      else if (forwardedRef) forwardedRef.current = element;
    },
    [forwardedRef]
  );

  // Theo dõi giá trị do react-hook-form đặt trực tiếp
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input && input.value !== typed) setTyped(input.value);
  });

  const close = useCallback(() => setOpen(false), []);
  const position = useAnchoredPosition(wrapperRef, open, close, 400, POPOVER_WIDTH);

  useLayoutEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!popoverRef.current?.contains(target) && !wrapperRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        inputRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const pick = (iso: string) => {
    if (inputRef.current) {
      setNativeValue(inputRef.current, iso);
      setTyped(iso);
    }
    setOpen(false);
    inputRef.current?.focus();
  };

  const minDate = fromDateInputValue(min as string | undefined);
  const maxDate = fromDateInputValue(max as string | undefined);
  const disabledDays: Matcher[] = [];
  if (minDate) disabledDays.push({ before: minDate });
  if (maxDate) disabledDays.push({ after: maxDate });
  const selected = fromDateInputValue(current);
  const hasDropdowns = captionLayout === 'dropdown';
  const startMonth = hasDropdowns ? (minDate ?? new Date(1900, 0, 1)) : undefined;
  const endMonth = hasDropdowns ? (maxDate ?? new Date(new Date().getFullYear(), 11, 31)) : undefined;
  const today = toDateInputValue(new Date());
  const todayAllowed = (!min || today >= String(min)) && (!max || today <= String(max));

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTyped(event.target.value);
    onChange?.(event);
  };

  return (
    <div ref={wrapperRef} className={cn('ui-date', open && 'is-open')}>
      <input
        ref={setRefs}
        type="date"
        className={cn('ui-field', 'ui-date__input', className)}
        value={value}
        defaultValue={defaultValue}
        min={min}
        max={max}
        disabled={disabled}
        onChange={handleChange}
        {...rest}
      />
      <button
        type="button"
        className="ui-date__button"
        aria-label="Mở lịch chọn ngày"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <i className="ph ph-calendar-blank" aria-hidden="true" />
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Chọn ngày"
            data-anchored-popover=""
            className="ui-date__popover"
            style={{ ...position, width: undefined, minWidth: POPOVER_WIDTH }}
          >
            <div className="date-range-picker">
              <DayPicker
                mode="single"
                locale={vi}
                weekStartsOn={1}
                captionLayout={captionLayout}
                startMonth={startMonth}
                endMonth={endMonth}
                defaultMonth={selected ?? minDate ?? undefined}
                selected={selected}
                disabled={disabledDays.length > 0 ? disabledDays : undefined}
                onSelect={(day) => day && pick(toDateInputValue(day))}
              />
            </div>
            <div className="ui-date__footer">
              <button type="button" className="ui-date__action" disabled={!todayAllowed} onClick={() => pick(today)}>
                Hôm nay
              </button>
              {!rest.required && current && (
                <button type="button" className="ui-date__action ui-date__action--muted" onClick={() => pick('')}>
                  Xóa ngày
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
});
