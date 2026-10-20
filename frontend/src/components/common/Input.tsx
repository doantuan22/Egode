import React from 'react';
import { cn } from '../../lib/utils';
import { DateField } from './DateField';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Nhãn gắn với ô nhập */
  label?: React.ReactNode;
  /** Lỗi của trường */
  error?: string;
  /** Gợi ý khi không có lỗi */
  hint?: string;
}

/** Ô nhập văn bản chuẩn */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const fieldProps = {
      id: inputId,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? errorId : hint ? hintId : undefined,
      className: cn('ui-field', className),
      ...props,
    };
    // Ô ngày có nút lịch trong trang quản trị
    const field = props.type === 'date' ? <DateField ref={ref} {...fieldProps} /> : <input ref={ref} {...fieldProps} />;

    if (!label && !error && !hint) return field;

    return (
      <div className="ui-field-group">
        {label && (
          <label htmlFor={inputId} className="ui-field-label">
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

Input.displayName = 'Input';
