import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { cn } from '../../lib/utils';

export type SimulationPhase = 'processing' | 'success' | 'error';

export interface SimulationDialogProps {
  phase: SimulationPhase;
  /** Heading while processing, e.g. "Đang xử lý thanh toán". */
  processingTitle: string;
  /** Short status lines shown one after the other while processing. */
  steps: string[];
  successTitle: string;
  successContent?: ReactNode;
  errorTitle?: string;
  errorMessage?: string;
  /** Label of the main button once finished (success or error). */
  primaryLabel: string;
  onPrimary: () => void;
}

const STEP_MS = 900;

/**
 * Modal for a simulated payment / refund: a spinner with changing status lines while it runs, then the outcome.
 * It cannot be dismissed while processing (no Escape, no button), so the customer cannot leave half-way through.
 */
export function SimulationDialog({ phase, processingTitle, steps, successTitle, successContent, errorTitle = 'Không thể hoàn tất', errorMessage, primaryLabel, onPrimary }: SimulationDialogProps) {
  const titleId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (phase !== 'processing') return;
    setStepIndex(0);
    const timer = setInterval(() => setStepIndex((current) => Math.min(current + 1, steps.length - 1)), STEP_MS);
    return () => clearInterval(timer);
  }, [phase, steps.length]);

  useEffect(() => {
    if (phase !== 'processing') primaryRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (phase === 'processing') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onPrimary();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [phase, onPrimary]);

  const progress = steps.length > 0 ? ((stepIndex + 1) / steps.length) * 100 : 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        {phase === 'processing' && (
          <>
            <div className="mx-auto mb-5 h-14 w-14 animate-spin rounded-full border-4 border-primary/20 border-t-primary" aria-hidden="true" />
            <h2 id={titleId} className="mb-2 text-lg font-bold text-heading">{processingTitle}</h2>
            <p role="status" aria-live="polite" className="min-h-[2.5rem] text-sm text-muted">{steps[stepIndex]}</p>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-tertiary" aria-hidden="true">
              <div className="h-full rounded-full bg-primary transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-4 text-xs text-muted">Vui lòng không đóng hoặc tải lại trang.</p>
          </>
        )}

        {phase === 'success' && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success-light text-success">
              <Icon name="check-circle" weight="fill" size={36} />
            </div>
            <h2 id={titleId} className="mb-3 text-lg font-bold text-heading">{successTitle}</h2>
            <div role="status" className="mb-6 text-sm leading-relaxed text-ink-sub">{successContent}</div>
            <Button ref={primaryRef} type="button" size="lg" className="w-full" onClick={onPrimary}>{primaryLabel}</Button>
          </>
        )}

        {phase === 'error' && (
          <>
            <div className={cn('mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger-light text-danger')}>
              <Icon name="warning-circle" weight="fill" size={36} />
            </div>
            <h2 id={titleId} className="mb-3 text-lg font-bold text-heading">{errorTitle}</h2>
            <p role="alert" className="mb-6 text-sm leading-relaxed text-ink-sub">{errorMessage}</p>
            <Button ref={primaryRef} type="button" size="lg" variant="outline" className="w-full" onClick={onPrimary}>{primaryLabel}</Button>
          </>
        )}
      </div>
    </div>
  );
}
