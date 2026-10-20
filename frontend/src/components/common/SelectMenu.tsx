import {
  Children,
  Fragment,
  forwardRef,
  isValidElement,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { useAnchoredPosition } from './useAnchoredPosition';

interface MenuOption {
  value: string;
  label: string;
  disabled: boolean;
}

const textOf = (node: ReactNode): string =>
  Children.toArray(node)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : isValidElement<{ children?: ReactNode }>(child) ? textOf(child.props.children) : ''))
    .join('');

/** Các option của select dưới dạng dữ liệu */
const readOptions = (children: ReactNode): MenuOption[] =>
  Children.toArray(children).flatMap((child): MenuOption[] => {
    if (!isValidElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>(child)) return [];
    if (child.type === Fragment || child.type === 'optgroup') return readOptions(child.props.children);
    if (child.type !== 'option') return [];
    const label = textOf(child.props.children);
    return [{ value: String(child.props.value ?? label), label, disabled: Boolean(child.props.disabled) }];
  });

/** Danh sách chọn có giao diện riêng, select gốc vẫn nằm trong DOM */
export const SelectMenu = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function SelectMenu(
  { className, children, disabled, onChange, onKeyDown, value, defaultValue, ...rest },
  forwardedRef
) {
  const nativeRef = useRef<HTMLSelectElement | null>(null);
  const faceRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const options = readOptions(children);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Phản chiếu giá trị của select gốc khi không điều khiển
  const [nativeValue, setNativeValue] = useState(defaultValue === undefined ? '' : String(defaultValue));
  const current = value === undefined ? nativeValue : String(value);
  const selected = options.find((option) => option.value === current);

  const setRefs = useCallback(
    (element: HTMLSelectElement | null) => {
      nativeRef.current = element;
      if (typeof forwardedRef === 'function') forwardedRef(element);
      else if (forwardedRef) forwardedRef.current = element;
    },
    [forwardedRef]
  );

  // Theo dõi giá trị do form đặt trực tiếp
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const native = nativeRef.current;
    if (native && native.value !== nativeValue) setNativeValue(native.value);
  });

  const close = useCallback(() => setOpen(false), []);
  // Danh sách căn theo khung rộng hơn bao quanh ô
  const anchor = useMemo(
    () => ({
      get current() {
        return faceRef.current?.closest<HTMLElement>('[data-select-anchor]') ?? faceRef.current;
      },
    }),
    []
  );
  const position = useAnchoredPosition(anchor, open, close, Math.min(280, options.length * 40 + 12));

  const openMenu = () => {
    if (disabled) return;
    setActiveIndex(Math.max(0, options.findIndex((option) => option.value === current)));
    setOpen(true);
  };

  const choose = (option: MenuOption) => {
    const native = nativeRef.current;
    if (native && !option.disabled) {
      native.value = option.value;
      native.dispatchEvent(new Event('change', { bubbles: true }));
      setNativeValue(option.value);
    }
    setOpen(false);
    nativeRef.current?.focus();
  };

  // Đưa tiêu điểm vào danh sách khi đang mở
  useLayoutEffect(() => {
    if (open && position) listRef.current?.focus({ preventScroll: true });
  }, [open, position]);

  // Kéo danh sách vào lại nếu tràn mép phải
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!open || !position || !list) return;
    const overflow = list.getBoundingClientRect().right - (window.innerWidth - 12);
    if (overflow > 0) list.style.left = `${Math.max(12, position.left - overflow)}px`;
  }, [open, position]);

  useLayoutEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex, position]);

  useLayoutEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!listRef.current?.contains(target) && !faceRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const move = (step: number) => {
    if (options.length === 0) return;
    let next = activeIndex;
    for (let tries = 0; tries < options.length; tries++) {
      next = (next + step + options.length) % options.length;
      if (!options[next].disabled) break;
    }
    setActiveIndex(next);
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (options[activeIndex]) choose(options[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      nativeRef.current?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    } else if (event.key.length === 1) {
      const typed = event.key.toLocaleLowerCase('vi');
      const startsWith = (option: MenuOption) => !option.disabled && option.label.toLocaleLowerCase('vi').startsWith(typed);
      const after = options.findIndex((option, index) => index > activeIndex && startsWith(option));
      const hit = after >= 0 ? after : options.findIndex(startsWith);
      if (hit >= 0) setActiveIndex(hit);
    }
  };

  const onNativeKeyDown = (event: KeyboardEvent<HTMLSelectElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === ' ' || event.key === 'F4' || (event.altKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp'))) {
      event.preventDefault();
      openMenu();
    }
  };

  const onNativeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setNativeValue(event.target.value);
    onChange?.(event);
  };

  return (
    <div className={cn('ui-select', open && 'is-open')}>
      <select
        ref={setRefs}
        className="ui-select__native"
        disabled={disabled}
        value={value}
        defaultValue={defaultValue}
        onChange={onNativeChange}
        onKeyDown={onNativeKeyDown}
        {...rest}
      >
        {children}
      </select>
      <button
        ref={faceRef}
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        data-invalid={rest['aria-invalid'] ? 'true' : undefined}
        className={cn('ui-select__face', className)}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        <span className={cn('ui-select__value', !selected && 'is-placeholder')}>{selected?.label ?? ' '}</span>
        <i className="ph ph-caret-down ui-select__caret" aria-hidden="true" />
      </button>
      {open &&
        position &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            data-anchored-popover=""
            aria-label={rest['aria-label']}
            aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
            className="ui-select__list"
            // Rộng ít nhất bằng ô chọn
            style={{ ...position, width: undefined, minWidth: position.width }}
            onKeyDown={onListKeyDown}
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.value === current}
                aria-disabled={option.disabled || undefined}
                data-active={index === activeIndex}
                className={cn('ui-select__option', index === activeIndex && 'is-active', option.value === current && 'is-selected', option.disabled && 'is-disabled')}
                onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                <span>{option.label}</span>
                {option.value === current && <i className="ph ph-check" aria-hidden="true" />}
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
});
