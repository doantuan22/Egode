import { useId } from 'react';

/** Bộ chọn số lượng có giới hạn */
export function QuantityStepper({ value, min = 0, max, label, onChange, disabled = false }: {
  value: number;
  min?: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const safeValue = Math.min(max, Math.max(min, value));
  return (
    <div className="quantity-stepper" role="group" aria-label={label}>
      <button type="button" className="quantity-stepper__button" aria-label={`Giảm ${label}`} aria-controls={id} disabled={disabled || safeValue <= min} onClick={() => onChange(safeValue - 1)}>−</button>
      <output id={id} className="quantity-stepper__value" aria-live="polite">{safeValue}</output>
      <button type="button" className="quantity-stepper__button" aria-label={`Tăng ${label}`} aria-controls={id} disabled={disabled || safeValue >= max} onClick={() => onChange(safeValue + 1)}>+</button>
    </div>
  );
}
