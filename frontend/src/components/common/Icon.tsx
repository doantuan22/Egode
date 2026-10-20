import type { CSSProperties } from 'react';
import { cn } from '../../lib/utils';

const WEIGHT_CLASS = { regular: 'ph', fill: 'ph-fill', bold: 'ph-bold', duotone: 'ph-duotone' } as const;

export interface IconProps {
  /** Tên biểu tượng Phosphor không có tiền tố ph- */
  name: string;
  weight?: keyof typeof WEIGHT_CLASS;
  /** Kích thước điểm ảnh */
  size?: number;
  className?: string;
  /** Chỉ đặt nhãn khi biểu tượng là nội dung duy nhất */
  label?: string;
}

/** Bộ biểu tượng duy nhất của ứng dụng */
export function Icon({ name, weight = 'regular', size, className, label }: IconProps) {
  const style: CSSProperties | undefined = size ? { fontSize: size } : undefined;
  return (
    <i
      className={cn(WEIGHT_CLASS[weight], `ph-${name}`, className)}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
