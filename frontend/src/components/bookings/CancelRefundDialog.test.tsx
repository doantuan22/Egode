import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CancelRefundDialog } from './CancelRefundDialog';
import type { BookingDetail } from '../../features/bookings/types';

const cancelled = (refunds: Array<{ TrangThai: string; SoTienHoan: number }>) =>
  ({
    MaXacNhanDatPhong: 'EGD-77',
    ThanhToan: [{ MaThanhToan: 1, SoTien: 1000000, PhuongThucThanhToan: 'VNPAY (mô phỏng)', TrangThai: 'Thành công', ThoiGianGiaoDich: '', HoanTien: refunds.map((r, i) => ({ MaHoanTien: i + 1, LyDoHoanTien: '', NgayYeuCau: '', NgayHoanTien: null, ...r })) }],
  }) as unknown as BookingDetail;

describe('CancelRefundDialog', () => {
  it('renders nothing when idle', () => {
    const { container } = render(<CancelRefundDialog flow={{ phase: 'idle' }} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('while processing: a loading dialog about the cancellation and refund, with no way to close it', () => {
    render(<CancelRefundDialog flow={{ phase: 'processing' }} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toHaveTextContent('Đang xử lý hủy đặt phòng và hoàn tiền');
    expect(screen.getByRole('status')).toHaveTextContent('Đang gửi yêu cầu hủy đặt phòng');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('a completed refund: says the amount was refunded to the original payment method', () => {
    render(<CancelRefundDialog flow={{ phase: 'success', booking: cancelled([{ TrangThai: 'Thành công', SoTienHoan: 750000 }]) }} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Hủy đặt phòng thành công');
    expect(dialog).toHaveTextContent('EGD-77');
    expect(dialog).toHaveTextContent('750.000');
    expect(dialog).toHaveTextContent('đã được hoàn về phương thức thanh toán ban đầu (VNPAY (mô phỏng))');
  });

  it('nothing refundable by the policy: says so, and does not claim any money came back', () => {
    render(<CancelRefundDialog flow={{ phase: 'success', booking: cancelled([]) }} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toHaveTextContent('không được hoàn tiền');
    expect(screen.getByRole('dialog')).not.toHaveTextContent('đã được hoàn về');
  });

  it('a refund that did not complete: cancelled, but never reported as refunded', () => {
    render(<CancelRefundDialog flow={{ phase: 'success', booking: cancelled([{ TrangThai: 'Thất bại', SoTienHoan: 1000000 }]) }} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Đã hủy, hoàn tiền chưa hoàn tất');
    expect(dialog).toHaveTextContent('Thử lại');
    expect(dialog).not.toHaveTextContent('đã được hoàn về');
  });

  it('an error shows the reason and can be closed', async () => {
    const onClose = vi.fn();
    render(<CancelRefundDialog flow={{ phase: 'error', message: 'Đặt phòng đã đổi trạng thái trước đó' }} onClose={onClose} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Đặt phòng đã đổi trạng thái trước đó');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Đóng' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Escape closes a finished dialog, but not a running one', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<CancelRefundDialog flow={{ phase: 'processing' }} onClose={onClose} />);
    const user = userEvent.setup();

    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();

    rerender(<CancelRefundDialog flow={{ phase: 'success', booking: cancelled([]) }} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
