import React from 'react';
import { cn } from '../../lib/utils';
import { useDashboardUi } from './DashboardUiContext';
import { SelectMenu } from './SelectMenu';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Nhãn gắn với ô chọn */
  label?: React.ReactNode;
  /** Lỗi của trường */
  error?: string;
  hint?: string;
  /** Tự vẽ danh sách thay cho danh sách của trình duyệt */
  menu?: boolean;
}

/** Ô chọn chuẩn cùng kiểu với Input */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, menu = false, id, children, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;
    const errorId = `${selectId}-error`;
    const hintId = `${selectId}-hint`;
    // Trong trang quản trị danh sách do SelectMenu vẽ
    const dashboardUi = useDashboardUi();
    const Control = menu || dashboardUi ? SelectMenu : 'select';

    const field = (
      <Control
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={cn(
          'ui-field',
          className
        )}
        {...props}
      >
        {children}
      </Control>
    );

    if (!label && !error && !hint) return field;

    return (
      <div className="ui-field-group">
        {label && (
          <label htmlFor={selectId} className="ui-field-label">
            {label}{props.required && <><span className="ui-field-label__required" aria-hidden="true">*</span><span className="visually-hidden"> (bắt buộc)</span></>}
          </label>
        )}
        <div>{field}</div>
        {error ? (
          <p id={errorId} className="ui-field-message ui-field-message--error">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="ui-field-message ui-field-message--hint">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
