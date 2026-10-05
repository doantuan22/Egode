import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { SimulationDialog } from '../../components/common/SimulationDialog';
import { formatCurrencyVND } from '../../lib/utils';
import { withMinimumDelay } from '../../lib/simulation';
import { ApiError } from '../../services/apiClient';
import { getPaymentConfig } from './api';
import { useCreateVnpayPayment, useSimulatedPayment } from './hooks';
import type { SimulatedPaymentResponse } from './types';

type FlowState =
  | { phase: 'idle' }
  | { phase: 'processing' }
  | { phase: 'success'; result: SimulatedPaymentResponse }
  | { phase: 'error'; message: string };

const STEPS = ['Đang kết nối cổng thanh toán…', 'Đang xác thực giao dịch…', 'Đang xác nhận thanh toán và đặt phòng…'];
const AUTO_CONTINUE_MS = 2000;

/**
 * "Thanh toán ngay" for one booking, whichever payment mode the server runs:
 *  - simulated: a processing dialog (spinner + status lines), the server records the payment and confirms the booking,
 *    the dialog says it succeeded and moves on to the result page;
 *  - vnpay: the server returns the gateway URL and the browser is sent there (the original redirect flow).
 * Render `dialog` somewhere in the page; call `start()` from the pay button.
 */
export function usePaymentFlow(bookingId: number): { start: () => void; isBusy: boolean; redirectError: unknown; dialog: ReactNode } {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const redirectPayment = useCreateVnpayPayment(bookingId);
  const simulatedPayment = useSimulatedPayment(bookingId);
  const [state, setState] = useState<FlowState>({ phase: 'idle' });

  const goToResult = () => {
    setState({ phase: 'idle' });
    navigate(`/payment/result?bookingId=${bookingId}&status=success`);
  };

  // After a success the dialog stays long enough to read, then continues by itself.
  const succeeded = state.phase === 'success';
  useEffect(() => {
    if (!succeeded) return;
    const timer = setTimeout(() => {
      setState({ phase: 'idle' });
      navigate(`/payment/result?bookingId=${bookingId}&status=success`);
    }, AUTO_CONTINUE_MS);
    return () => clearTimeout(timer);
  }, [succeeded, navigate, bookingId]);

  const start = () => {
    void (async () => {
      let provider: 'simulated' | 'vnpay';
      try {
        provider = (await queryClient.fetchQuery({ queryKey: ['payment-config'], queryFn: getPaymentConfig, staleTime: Infinity })).provider;
      } catch {
        setState({ phase: 'error', message: 'Không xác định được phương thức thanh toán của hệ thống. Vui lòng thử lại.' });
        return;
      }

      if (provider === 'vnpay') {
        redirectPayment.mutate(undefined, { onSuccess: (result) => { window.location.href = result.paymentUrl; } });
        return;
      }

      setState({ phase: 'processing' });
      try {
        const result = await withMinimumDelay(simulatedPayment.mutateAsync());
        setState({ phase: 'success', result });
      } catch (error) {
        void queryClient.invalidateQueries({ queryKey: ['bookings', bookingId] });
        setState({ phase: 'error', message: error instanceof ApiError ? error.message : 'Thanh toán không thành công. Vui lòng thử lại.' });
      }
    })();
  };

  const dialog =
    state.phase === 'idle' ? null : (
      <SimulationDialog
        phase={state.phase}
        processingTitle="Đang xử lý thanh toán"
        steps={STEPS}
        successTitle="Thanh toán thành công!"
        successContent={
          state.phase === 'success' ? (
            <>
              <p>
                Đã thanh toán <strong className="text-primary">{formatCurrencyVND(state.result.soTien)}</strong> cho đơn <strong>{state.result.maXacNhanDatPhong}</strong>.
              </p>
              <p className="mt-1">Đặt phòng của bạn đã được xác nhận.</p>
              <p className="mt-2 text-xs text-muted">Mã giao dịch: {state.result.maGiaoDichDoiTac}</p>
            </>
          ) : null
        }
        errorTitle="Thanh toán không thành công"
        errorMessage={state.phase === 'error' ? state.message : undefined}
        primaryLabel={state.phase === 'success' ? 'Xem kết quả' : 'Đóng'}
        onPrimary={state.phase === 'success' ? goToResult : () => setState({ phase: 'idle' })}
      />
    );

  return {
    start,
    isBusy: state.phase === 'processing' || redirectPayment.isPending,
    redirectError: redirectPayment.isError ? redirectPayment.error : null,
    dialog,
  };
}
