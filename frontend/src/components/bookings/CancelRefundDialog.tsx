import type { ReactNode } from 'react';
import { SimulationDialog } from '../common/SimulationDialog';
import { summarizeRefund } from '../../features/bookings/refund-message';
import type { BookingDetail } from '../../features/bookings/types';
import { formatCurrencyVND } from '../../lib/utils';

export type CancelFlowState =
  | { phase: 'idle' }
  | { phase: 'processing' }
  | { phase: 'success'; booking: BookingDetail }
  | { phase: 'error'; message: string };

const STEPS = ['Đang gửi yêu cầu hủy đặt phòng…', 'Đang tính số tiền hoàn theo chính sách hủy…', 'Đang hoàn tiền về phương thức thanh toán ban đầu…'];

/** Loading, then the outcome, of cancelling a booking that was already paid (so a refund may be due). */
export function CancelRefundDialog({ flow, onClose }: { flow: CancelFlowState; onClose: () => void }) {
  if (flow.phase === 'idle') return null;

  let successTitle = 'Hủy đặt phòng thành công';
  let content: ReactNode = null;
  if (flow.phase === 'success') {
    const refund = summarizeRefund(flow.booking);
    const method = refund.method ? ` (${refund.method})` : '';
    const cancelled = <p>Đơn <strong>{flow.booking.MaXacNhanDatPhong}</strong> đã được hủy.</p>;
    if (refund.kind === 'refunded') {
      content = (
        <>
          {cancelled}
          <p className="mt-2">
            Số tiền <strong className="text-primary">{formatCurrencyVND(refund.amount)}</strong> đã được hoàn về phương thức thanh toán ban đầu{method}.
          </p>
        </>
      );
    } else if (refund.kind === 'unfinished') {
      successTitle = 'Đã hủy, hoàn tiền chưa hoàn tất';
      content = (
        <>
          {cancelled}
          <p className="mt-2">Khoản hoàn tiền chưa hoàn tất. Bạn có thể bấm “Thử lại” ở phần thanh toán của đơn.</p>
        </>
      );
    } else {
      content = (
        <>
          {cancelled}
          <p className="mt-2">Theo chính sách hủy, đơn này không được hoàn tiền.</p>
        </>
      );
    }
  }

  return (
    <SimulationDialog
      phase={flow.phase}
      processingTitle="Đang xử lý hủy đặt phòng và hoàn tiền"
      steps={STEPS}
      successTitle={successTitle}
      successContent={content}
      errorTitle="Không thể hủy đặt phòng"
      errorMessage={flow.phase === 'error' ? flow.message : undefined}
      primaryLabel="Đóng"
      onPrimary={onClose}
    />
  );
}
