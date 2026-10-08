import { forwardRef, useCallback, useLayoutEffect, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker, type Matcher } from 'react-day-picker';
import { vi } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { cn, fromDateInputValue, toDateInputValue } from '../../lib/utils';
import { useAnchoredPosition } from './useAnchoredPosition';
import { useDashboardUi } from './DashboardUiContext';

// `type` is accepted (and ignored) so a `<input type="date">` can be swapped for `<DateField>` without touching its props.
type DateFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { type?: string };

const POPOVER_WIDTH = 330;

const setNativeValue = (input: HTMLInputElement, value: string) => {
  // React tracks the value of an <input>: go through the prototype setter so the change is seen as a real edit.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

/**
 * `<input type="date">`. In the dashboards it keeps the native field (typing, validation, react-hook-form) and adds a
 * button that opens the same calendar the customer-facing search uses; everywhere else it is the plain native input.
 * Works on `YYYY-MM-DD` strings like the rest of the app.
 */
export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(function DateField({ className, ...props }, forwardedRef) {
  const enhanced = useDashboardUi();
  if (!enhanced) return <input ref={forwardedRef} type="date" className={className} {...props} />;
  return <EnhancedDateField ref={forwardedRef} className={className} {...props} />;
});

const EnhancedDateField = forwardRef<HTMLInputElement, DateFieldProps>(function EnhancedDateField(
  { className, onChange, value, defaultValue, min, max, disabled, ...rest },
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

  // react-hook-form can set the value without an event: follow it before paint.
  // Runs after every render on purpose (nothing re-renders us when the DOM value is set directly); it only sets state
  // when the two differ, so it settles after one extra pass.
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
