import { useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { formatCurrencyVND } from '../../lib/utils';
import { Button } from '../common/Button';
import { Textarea } from '../common/Textarea';

/** Hành động khách có thể làm theo trạng thái đơn */
export interface BookingActionsProps {
  canPay: boolean;
  canCancel: boolean;
  onPay: () => void;
  isPaying: boolean;
  payError: unknown;
  /** Gọi kèm lý do tùy chọn, onDone đóng hộp xác nhận */
  onCancel: (note: string | undefined, onDone: () => void) => void;
  isCancelling: boolean;
  cancelError: Error | null;
  /** Số tiền sẽ được hoàn khi hủy */
  refundPreview: { paid: number; percent: number; amount: number };
}

export function BookingActions({ canPay, canCancel, onPay, isPaying, payError, onCancel, isCancelling, cancelError, refundPreview }: BookingActionsProps) {
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState('');

  if (!canPay && !canCancel) return null;

  return (
    <>
      {canPay && (
        <div className="flex flex-col gap-2">
          {Boolean(payError) && (
            <div role="alert" className="rounded-lg bg-danger-light px-3 py-2 text-xs text-danger-ink">
              {payError instanceof ApiError ? payError.message : 'Lỗi tạo TT'}
            </div>
          )}
          <Button type="button" size="lg" className="w-full" onClick={onPay} loading={isPaying}>
            {isPaying ? 'Đang xử lý...' : 'Thanh toán ngay'}
          </Button>
        </div>
      )}

      {canCancel && (!confirming ? (
        <Button type="button" variant="danger-outline" className="w-full" onClick={() => setConfirming(true)}>Hủy đặt phòng này</Button>
      ) : (
        <div className="bg-danger-light border border-danger/30 rounded-xl p-4">
          <h3 className="text-sm font-bold text-danger-ink mb-2">Xác nhận hủy đặt phòng?</h3>
          <div className="bg-surface border border-danger/20 rounded-lg p-3 mb-3 text-[0.8125rem] text-danger-ink">
            {refundPreview.paid > 0 ? (
              <>
                <div className="flex justify-between mb-1"><span>Đã thanh toán:</span> <span>{formatCurrencyVND(refundPreview.paid)}</span></div>
                <div className="flex justify-between mb-1"><span>Dự kiến hoàn ({refundPreview.percent}%):</span> <strong className="text-base">{formatCurrencyVND(refundPreview.amount)}</strong></div>
                <div className="text-[0.6875rem] mt-2 opacity-80">Hệ thống sẽ tính lại chính xác khi bạn xác nhận.</div>
              </>
            ) : (
              <div>Đơn này chưa thanh toán nên sẽ không có hoàn tiền.</div>
            )}
          </div>

          <div className="mb-4">
            <Textarea id="booking-detail-field-1" label="Lý do hủy (không bắt buộc)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="text-sm" />
          </div>

          {cancelError && <div role="alert" className="mb-3 text-xs text-danger-ink bg-danger-light p-2 rounded">Lỗi: {cancelError.message}</div>}

          <div className="flex gap-2">
            <Button type="button" variant="danger" className="flex-1" onClick={() => onCancel(note.trim() || undefined, () => setConfirming(false))} loading={isCancelling}>
              {isCancelling ? 'Đang xử lý' : 'Xác nhận hủy'}
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={() => setConfirming(false)}>Không hủy</Button>
          </div>
        </div>
      ))}
    </>
  );
}
