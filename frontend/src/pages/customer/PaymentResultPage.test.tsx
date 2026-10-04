import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentResultPage from './PaymentResultPage';
import { useCreateVnpayPayment, usePaymentStatus } from '../../features/payments/hooks';
import { formatCurrencyVND } from '../../lib/utils';
import { ApiError } from '../../services/apiClient';
import { renderWithProviders } from '../../test/testUtils';
import type { PaymentStatusResponse } from '../../features/payments/types';
import type { PaymentView, RefundView } from '../../features/bookings/types';

vi.mock('../../features/payments/hooks');

const refund = (TrangThai: string, SoTienHoan = 100000) => ({ MaHoanTien: 1, SoTienHoan, LyDoHoanTien: '', TrangThai, NgayYeuCau: '', NgayHoanTien: null }) as RefundView;
const payment = (TrangThai: string, HoanTien: RefundView[] = []) => ({ MaThanhToan: 1, SoTien: 100000, PhuongThucThanhToan: 'VNPAY', TrangThai, ThoiGianGiaoDich: '', HoanTien }) as PaymentView;
const data = (TrangThaiDatPhong: string, ThanhToan: PaymentView[]): PaymentStatusResponse => ({ MaDatPhong: 42, MaXacNhanDatPhong: 'EGD-42', TrangThaiDatPhong, ThanhToan });

const mockStatus = (patch: Partial<ReturnType<typeof usePaymentStatus>>) =>
  vi.mocked(usePaymentStatus).mockReturnValue({ data: undefined, isLoading: false, isError: false, error: null, refetch: vi.fn(), ...patch } as ReturnType<typeof usePaymentStatus>);

const renderPage = (search: string) => renderWithProviders(<PaymentResultPage />, { route: `/payment/result${search}` });

const payMutate = vi.fn();

beforeEach(() => {
  vi.mocked(usePaymentStatus).mockReset();
  mockStatus({});
  payMutate.mockReset();
  vi.mocked(useCreateVnpayPayment).mockReturnValue({ mutate: payMutate, isPending: false, isError: false, error: null } as unknown as ReturnType<typeof useCreateVnpayPayment>);
});

describe('PaymentResultPage without a booking id', () => {
  it.each(['?status=unknown', '?status=failed&bookingId=', ''])('says the result cannot be determined instead of "processing" (%s)', (search) => {
    renderPage(search);

    expect(screen.getByRole('heading', { name: 'Chưa xác định được kết quả thanh toán' })).toBeInTheDocument();
    expect(screen.queryByText('Đang xử lý kết quả...')).not.toBeInTheDocument();
    expect(screen.queryByText('Thanh toán thành công!')).not.toBeInTheDocument();
    expect(screen.queryByText('Thanh toán không thành công')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem đặt phòng của tôi' })).toHaveAttribute('href', '/bookings');
    expect(screen.getByRole('link', { name: 'Liên hệ hỗ trợ' })).toHaveAttribute('href', '/support');
  });

  it('does not query the API without a valid booking id', () => {
    renderPage('?status=unknown');
    expect(usePaymentStatus).toHaveBeenCalledWith(0, { enabled: false });
  });
});

describe('PaymentResultPage for a booking with nothing to pay (total 0, confirmed on the spot)', () => {
  it('reports a successful booking — not a payment — with 0 đ and no transaction', () => {
    mockStatus({ data: data('Đã xác nhận', []) });
    renderPage('?bookingId=42&status=success');

    expect(screen.getByRole('heading', { name: 'Đặt phòng thành công!' })).toBeInTheDocument();
    expect(screen.getByText(/không cần thanh toán/)).toBeInTheDocument();
    expect(screen.getByText(formatCurrencyVND(0))).toBeInTheDocument();
    expect(screen.getByText('Không phát sinh giao dịch thanh toán cho đơn này.')).toBeInTheDocument();
    expect(screen.queryByText('Thanh toán thành công!')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thử thanh toán lại/ })).not.toBeInTheDocument();
  });

  it('a paid booking still reads "Thanh toán thành công!"', () => {
    mockStatus({ data: data('Đã xác nhận', [payment('Thành công')]) });
    renderPage('?bookingId=42&status=success');

    expect(screen.getByRole('heading', { name: 'Thanh toán thành công!' })).toBeInTheDocument();
    expect(screen.queryByText('Không phát sinh giao dịch thanh toán cho đơn này.')).not.toBeInTheDocument();
  });
});

describe('PaymentResultPage when the booking expired but the payment went through', () => {
  const render = (refunds: RefundView[]) => {
    mockStatus({ data: data('Đã hủy', [payment('Thành công', refunds)]) });
    renderPage('?bookingId=42&status=failed');
  };

  it('explains the booking was not confirmed and that the money was refunded', () => {
    render([refund('Thành công')]);

    expect(screen.getByRole('heading', { name: 'Đơn đặt phòng không được xác nhận' })).toBeInTheDocument();
    expect(screen.getByText(`Khoản thanh toán ${formatCurrencyVND(100000)} đã được hoàn lại đầy đủ.`)).toBeInTheDocument();
    expect(screen.queryByText('Đang xử lý kết quả...')).not.toBeInTheDocument();
    expect(screen.queryByText('Thanh toán thành công!')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem chi tiết đơn' })).toHaveAttribute('href', '/bookings/42');
  });

  it('shows a partial refund with the real amounts', () => {
    render([refund('Thành công', 60000)]);
    expect(screen.getByText(`Đã hoàn ${formatCurrencyVND(60000)} trong số ${formatCurrencyVND(100000)} đã thanh toán.`)).toBeInTheDocument();
  });

  it('says the refund is still being processed', () => {
    render([refund('Chờ xử lý')]);
    expect(screen.getByText(/Yêu cầu hoàn tiền đang được xử lý/)).toBeInTheDocument();
  });

  it('says the refund failed and points to the retry in the booking detail', () => {
    render([refund('Thất bại')]);
    expect(screen.getByText(/Hoàn tiền chưa thành công/)).toBeInTheDocument();
  });

  it('says no refund was recorded and quotes the booking code', () => {
    render([]);
    expect(screen.getByText(/chưa ghi nhận yêu cầu hoàn tiền/)).toHaveTextContent('EGD-42');
  });
});

describe('PaymentResultPage other outcomes keep working', () => {
  it('confirmed booking', () => {
    mockStatus({ data: data('Đã xác nhận', [payment('Thành công')]) });
    renderPage('?bookingId=42&status=success');
    expect(screen.getByRole('heading', { name: 'Thanh toán thành công!' })).toBeInTheDocument();
  });

  it('confirmed booking shows the customer-facing booking code, not the internal id', () => {
    mockStatus({ data: data('Đã xác nhận', [payment('Thành công')]) });
    renderPage('?bookingId=42&status=success');

    expect(screen.getByText('EGD-42')).toBeInTheDocument();
    expect(screen.queryByText(/^42$/)).not.toBeInTheDocument();
  });

  it('a completed stay opened from an old link still shows the paid result instead of "processing"', () => {
    mockStatus({ data: data('Hoàn tất', [payment('Thành công')]) });
    renderPage('?bookingId=42&status=success');

    expect(screen.getByRole('heading', { name: 'Thanh toán thành công!' })).toBeInTheDocument();
  });

  it('failed payment', () => {
    mockStatus({ data: data('Chờ thanh toán', [payment('Thất bại')]) });
    renderPage('?bookingId=42&status=failed');
    expect(screen.getByRole('heading', { name: 'Thanh toán không thành công' })).toBeInTheDocument();
  });

  it('still-pending payment', () => {
    mockStatus({ data: data('Chờ thanh toán', [payment('Chờ xử lý')]) });
    renderPage('?bookingId=42&status=success');
    expect(screen.getByRole('heading', { name: 'Đang xử lý kết quả...' })).toBeInTheDocument();
  });

  it('shows an error with a retry when the status request fails, instead of "processing"', async () => {
    const refetch = vi.fn();
    mockStatus({ isError: true, error: new ApiError('Bạn không có quyền xem thanh toán của đặt phòng này', 403), refetch });
    renderPage('?bookingId=42&status=success');

    expect(screen.getByRole('heading', { name: 'Không thể tải kết quả thanh toán' })).toBeInTheDocument();
    expect(screen.getByText('Bạn không có quyền xem thanh toán của đặt phòng này')).toBeInTheDocument();
    expect(screen.queryByText('Đang xử lý kết quả...')).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});

describe('PaymentResultPage retry after a failed payment', () => {
  it('offers to pay again while the booking is still waiting for payment', async () => {
    mockStatus({ data: data('Chờ thanh toán', [payment('Thất bại')]) });
    renderPage('?bookingId=42&status=failed');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Thử thanh toán lại' }));

    expect(payMutate).toHaveBeenCalledOnce();
    // The mutation's onSuccess sends the browser to the VNPAY payment URL.
    const [, options] = payMutate.mock.calls[0] as [undefined, { onSuccess: (result: { paymentUrl: string }) => void }];
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { href: '' } });
    options.onSuccess({ paymentUrl: 'https://pay.test/vnp' });
    expect(window.location.href).toBe('https://pay.test/vnp');
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });

  it('does not offer to pay again once the booking is cancelled (the hold expired)', () => {
    mockStatus({ data: data('Đã hủy', [payment('Thất bại')]) });
    renderPage('?bookingId=42&status=failed');

    expect(screen.getByRole('heading', { name: 'Thanh toán không thành công' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thử thanh toán lại' })).not.toBeInTheDocument();
  });

  it('shows why starting the payment failed', () => {
    mockStatus({ data: data('Chờ thanh toán', [payment('Thất bại')]) });
    vi.mocked(useCreateVnpayPayment).mockReturnValue({ mutate: payMutate, isPending: false, isError: true, error: new ApiError('Đặt phòng đã hết hạn thanh toán', 409) } as unknown as ReturnType<typeof useCreateVnpayPayment>);
    renderPage('?bookingId=42&status=failed');

    expect(screen.getByRole('alert')).toHaveTextContent('Đặt phòng đã hết hạn thanh toán');
  });
});
