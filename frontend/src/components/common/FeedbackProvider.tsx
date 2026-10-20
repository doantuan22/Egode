/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
}

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

/** Biểu tượng theo từng loại thông báo */
const TOAST_ICONS = { success: 'check-circle', error: 'warning-octagon', warning: 'warning', info: 'info' } as const;
/** Lỗi hiện lâu hơn thông báo thành công */
const toastDuration = (options: ToastOptions) => options.duration ?? (options.tone === 'error' ? 8000 : 5000);

interface FeedbackContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  notify: (options: ToastOptions) => void;
}

interface ToastItem extends ToastOptions { id: number }
interface ConfirmItem { options: ConfirmOptions; resolve: (value: boolean) => void }

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function useFeedback() {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error('useFeedback must be used inside FeedbackProvider');
  return value;
}

export function useToast() {
  return useFeedback().notify;
}

export function useConfirm() {
  return useFeedback().confirm;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmation, setConfirmation] = useState<ConfirmItem | null>(null);
  const activeConfirmation = useRef<ConfirmItem | null>(null);
  const nextToastId = useRef(0);
  const toastTimers = useRef(new Map<number, number>());
  const toastOrder = useRef<number[]>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const titleId = `confirm-title-${id}`;
  const descriptionId = `confirm-description-${id}`;

  const notify = useCallback((options: ToastOptions) => {
    const id = ++nextToastId.current;
    const evictedId = toastOrder.current.length >= 3 ? toastOrder.current.shift() : undefined;
    if (evictedId !== undefined) {
      const timer = toastTimers.current.get(evictedId);
      if (timer !== undefined) window.clearTimeout(timer);
      toastTimers.current.delete(evictedId);
    }
    toastOrder.current.push(id);
    setToasts((current) => [...current.filter((toast) => toast.id !== evictedId), { ...options, id }].slice(-3));
    toastTimers.current.set(id, window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      toastTimers.current.delete(id);
      toastOrder.current = toastOrder.current.filter((toastId) => toastId !== id);
    }, toastDuration(options)));
  }, []);

  const dismissToast = useCallback((id: number) => {
    const timer = toastTimers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    toastTimers.current.delete(id);
    toastOrder.current = toastOrder.current.filter((toastId) => toastId !== id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    if (activeConfirmation.current) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      const request = { options, resolve };
      activeConfirmation.current = request;
      setConfirmation(request);
    });
  }, []);

  const finishConfirmation = useCallback((accepted: boolean) => {
    const request = activeConfirmation.current;
    if (!request) return;
    activeConfirmation.current = null;
    if (dialogRef.current?.open) {
      if (typeof dialogRef.current.close === 'function') dialogRef.current.close();
      else dialogRef.current.removeAttribute('open');
    }
    setConfirmation(null);
    request.resolve(accepted);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!confirmation || !dialog || dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }, [confirmation]);

  useEffect(() => () => toastTimers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const feedbackValue = { confirm, notify };

  return (
    <FeedbackContext.Provider value={feedbackValue}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <>
          <div className="toast-stack" aria-label="Thông báo" aria-live="polite" aria-relevant="additions text">
            {toasts.map((toast) => (
              <div key={toast.id} className={`toast toast-${toast.tone ?? 'info'}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
                <span className="toast__icon" aria-hidden="true">
                  <i className={`ph-fill ph-${TOAST_ICONS[toast.tone ?? 'info']}`} />
                </span>
                <span className="toast__content">
                  <strong>{toast.title}</strong>
                  {toast.description && <span>{toast.description}</span>}
                </span>
                <button type="button" className="toast__close" aria-label="Đóng thông báo" onClick={() => dismissToast(toast.id)}>
                  <i className="ph ph-x" aria-hidden="true" />
                </button>
                <span className="toast__timer" style={{ animationDuration: `${toastDuration(toast)}ms` }} aria-hidden="true" />
              </div>
            ))}
          </div>
          <dialog
            ref={dialogRef}
            className="confirm-dialog"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onCancel={(event) => { event.preventDefault(); finishConfirmation(false); }}
            onClick={(event) => { if (event.target === event.currentTarget) finishConfirmation(false); }}
          >
            {confirmation && (
              <div className="confirm-dialog__content">
                <h2 id={titleId}>{confirmation.options.title}</h2>
                <p id={descriptionId}>{confirmation.options.description}</p>
                <div className="confirm-dialog__actions">
                  <Button variant="secondary" onClick={() => finishConfirmation(false)}>{confirmation.options.cancelLabel ?? 'Quay lại'}</Button>
                  <Button variant={confirmation.options.variant === 'danger' ? 'danger' : 'primary'} onClick={() => finishConfirmation(true)}>
                    {confirmation.options.confirmLabel ?? 'Xác nhận'}
                  </Button>
                </div>
              </div>
            )}
          </dialog>
        </>,
        document.body
      )}
    </FeedbackContext.Provider>
  );
}
