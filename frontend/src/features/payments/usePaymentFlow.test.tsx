import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePaymentFlow } from './usePaymentFlow';
import { getPaymentConfig } from './api';
import { useCreateVnpayPayment, useSimulatedPayment } from './hooks';
import { ApiError } from '../../services/apiClient';
import { renderWithProviders } from '../../test/testUtils';

vi.mock('./api');
vi.mock('./hooks');
// The server answers at once; the screen keeps the animation for a moment. Tests do not wait for that moment.
vi.mock('../../lib/simulation', () => ({ SIMULATION_DELAY_MS: 0, withMinimumDelay: <T,>(work: Promise<T>) => work }));

const result = { maThanhToan: 9, maGiaoDichDoiTac: 'PAYABC123', maDatPhong: 5, maXacNhanDatPhong: 'EGD-5', soTien: 1_250_000, trangThaiThanhToan: 'Thành công', trangThaiDatPhong: 'Đã xác nhận', thoiGianThanhToan: '2030-01-01T00:00:00.000Z' };
const mutateAsync = vi.fn();
const redirectMutate = vi.fn();

function Probe() {
  const flow = usePaymentFlow(5);
  return (
    <div>
      <button type="button" onClick={flow.start} disabled={flow.isBusy}>Thanh toán ngay</button>
      {Boolean(flow.redirectError) && <p role="alert">redirect failed</p>}
      {flow.dialog}
    </div>
  );
}
function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}
const open = () =>
  renderWithProviders(
    <Routes>
      <Route path="/bookings/5" element={<Probe />} />
      <Route path="/payment/result" element={<Where />} />
    </Routes>,
    { route: '/bookings/5' }
  );

beforeEach(() => {
  mutateAsync.mockReset();
  redirectMutate.mockReset();
  vi.mocked(getPaymentConfig).mockResolvedValue({ provider: 'simulated' });
  vi.mocked(useSimulatedPayment).mockReturnValue({ mutateAsync } as unknown as ReturnType<typeof useSimulatedPayment>);
  vi.mocked(useCreateVnpayPayment).mockReturnValue({ mutate: redirectMutate, isPending: false, isError: false, error: null } as unknown as ReturnType<typeof useCreateVnpayPayment>);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePaymentFlow — simulated payment', () => {
  it('shows the processing dialog while the payment is being recorded, then the success message with amount, order and reference', async () => {
    let finish: (value: typeof result) => void = () => undefined;
    mutateAsync.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    open();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Thanh toán ngay' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Đang xử lý thanh toán');
    expect(screen.getByRole('status')).toHaveTextContent('Đang kết nối cổng thanh toán');
    expect(screen.queryByRole('button', { name: 'Xem kết quả' })).not.toBeInTheDocument(); // cannot be dismissed mid-way
    expect(redirectMutate).not.toHaveBeenCalled(); // no gateway redirect in this mode

    await act(async () => finish(result));

    expect(await screen.findByText('Thanh toán thành công!')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent('1.250.000');
    expect(screen.getByRole('dialog')).toHaveTextContent('EGD-5');
    expect(screen.getByRole('dialog')).toHaveTextContent('PAYABC123');
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('"Xem kết quả" opens the payment result page for that booking', async () => {
    mutateAsync.mockResolvedValue(result);
    open();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Thanh toán ngay' }));

    await user.click(await screen.findByRole('button', { name: 'Xem kết quả' }));

    expect(await screen.findByTestId('where')).toHaveTextContent('/payment/result?bookingId=5&status=success');
  });

  it('after the success message it continues to the result page by itself', async () => {
    mutateAsync.mockResolvedValue(result);
    open();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Thanh toán ngay' }));
    await screen.findByText('Thanh toán thành công!');

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/payment/result?bookingId=5&status=success'), { timeout: 4000 });
  });

  it('a refusal from the server is shown in the dialog and the customer can close it and stay on the page', async () => {
    mutateAsync.mockRejectedValue(new ApiError('Không thể tạo yêu cầu thanh toán — đặt phòng đang ở trạng thái "Đã hủy"', 400));
    open();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Thanh toán ngay' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('đặt phòng đang ở trạng thái "Đã hủy"');
    await user.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thanh toán ngay' })).toBeEnabled();
  });

  it('cannot be started twice while it is running', async () => {
    mutateAsync.mockReturnValue(new Promise(() => undefined));
    open();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Thanh toán ngay' }));
    await screen.findByRole('dialog');

    expect(screen.getByRole('button', { name: 'Thanh toán ngay' })).toBeDisabled();
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('if the payment mode cannot be read, it says so instead of guessing', async () => {
    vi.mocked(getPaymentConfig).mockRejectedValue(new ApiError('down', 500));
    open();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Thanh toán ngay' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Không xác định được phương thức thanh toán');
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(redirectMutate).not.toHaveBeenCalled();
  });
});

describe('usePaymentFlow — real gateway mode', () => {
  it('asks the server for the gateway URL instead of running the simulation (no dialog)', async () => {
    vi.mocked(getPaymentConfig).mockResolvedValue({ provider: 'vnpay' });
    open();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Thanh toán ngay' }));

    await waitFor(() => expect(redirectMutate).toHaveBeenCalledTimes(1));
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
