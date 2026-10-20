import { Icon } from '../common/Icon';
import { useCountdown } from '../../hooks/useCountdown';
import { formatCountdown, formatDateTimeVi } from '../../lib/utils';

/** Thông báo đơn chưa thanh toán, thời hạn giữ phòng và thời gian còn lại */
export function PaymentHoldNotice({ deadline, secondsLeft, startedAt, justBooked = false, onExpire }: {
  deadline: string;
  secondsLeft: number;
  startedAt: number;
  justBooked?: boolean;
  onExpire: () => void;
}) {
  const remaining = useCountdown(secondsLeft, startedAt, onExpire) ?? secondsLeft;
  const expired = remaining <= 0;

  return (
    <section className="rounded-2xl border border-warning/30 bg-warning-light p-5 sm:p-6" aria-labelledby="payment-hold-title">
      <div className="flex items-start gap-4">
        <span className="mt-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-full bg-warning-light text-warning-ink"><Icon name="clock" size={20} /></span>
        <div className="min-w-0 flex-1">
          <h2 id="payment-hold-title" className="text-lg font-bold text-ink">{justBooked ? 'Đã tạo đơn đặt phòng' : 'Đơn đang chờ thanh toán'}</h2>
          {expired ? (
            <p className="mt-1 text-sm text-ink-muted" role="status">Đã hết thời gian giữ chỗ. Đang cập nhật trạng thái đơn…</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-ink-muted">Phòng đang được giữ cho bạn. Vui lòng thanh toán trước {formatDateTimeVi(deadline)} để hoàn tất đặt phòng.</p>
              <p className="mt-3 flex items-baseline gap-2 text-sm text-ink-muted">
                <span>Thời gian giữ chỗ còn lại</span>
                <span role="timer" className="text-2xl font-bold tabular-nums text-warning-ink">{formatCountdown(remaining)}</span>
              </p>
              <p className="mt-2 text-xs text-ink-muted">Quá hạn, đơn sẽ tự hủy và phòng được trả lại.</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
