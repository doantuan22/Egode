import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BookingDetailPage from './BookingDetailPage';
import { useBookingDetail, useCancelBooking } from '../../features/bookings/hooks';
import { useCreateVnpayPayment, useRetryRefund } from '../../features/payments/hooks';
import { useCreateReview, useMyReview } from '../../features/reviews/hooks';
import { renderWithProviders } from '../../test/testUtils';
import { ApiError } from '../../services/apiClient';
import type { BookingDetail } from '../../features/bookings/types';

vi.mock('../../features/bookings/hooks');
vi.mock('../../features/payments/hooks');
vi.mock('../../features/reviews/hooks');
// The server answers at once; the screen keeps the animation for a moment. Tests do not wait for that moment.
vi.mock('../../lib/simulation', () => ({ SIMULATION_DELAY_MS: 0, withMinimumDelay: <T,>(work: Promise<T>) => work }));

const booking = (TrangThai: string) =>
  ({
    MaDatPhong: 5,
    MaXacNhanDatPhong: 'EGD-5',
    MaKhachSan: 1,
    TenKhachSan: 'Khách sạn thử',
    DiaChiChiTiet: '1 Đường Thử Nghiệm, Hà Nội',
    AnhDaiDien: 'https://images.example.test/hotel-cover.jpg',
    NgayNhanPhong: '2030-01-01',
    NgayTraPhong: '2030-01-02',
    GioNhanPhong: '14:00',
    GioTraPhong: '12:00',
    ThoiDiemNhanPhong: '2030-01-01T07:00:00.000Z',
    ThoiDiemTraPhong: '2030-01-02T05:00:00.000Z',
    SoDem: 1,
    GhiChu: null,
    TrangThai,
    TongTienPhong: 1000000,
    SoTienGiam: 0,
    KhuyenMai: null,
    TongTienThanhToan: 1000000,
    ChiTietPhong: [{ MaLoaiPhong: 1, TenLoaiPhong: 'Phòng đôi', SoLuong: 1 }],
    ChinhSachHuy: { MaChinhSachHuy: 1, TenChinhSach: 'Linh hoạt', MoTa: '', ChiTiet: [{ SoGioTruocNhanPhong: 24, TyLeHoanTien: 100 }] },
    ThanhToan: [],
    HanThanhToan: TrangThai === 'Chờ thanh toán' ? '2030-01-01T10:15:00.000Z' : null,
    SoGiayConLai: TrangThai === 'Chờ thanh toán' ? 600 : null,
  }) as unknown as BookingDetail;

const idle = { mutate: vi.fn(), isPending: false, isError: false };

beforeEach(() => {
  vi.mocked(useCancelBooking).mockReturnValue(idle as unknown as ReturnType<typeof useCancelBooking>);
  vi.mocked(useCreateVnpayPayment).mockReturnValue(idle as unknown as ReturnType<typeof useCreateVnpayPayment>);
  vi.mocked(useRetryRefund).mockReturnValue(idle as unknown as ReturnType<typeof useRetryRefund>);
  vi.mocked(useCreateReview).mockReturnValue(idle as unknown as ReturnType<typeof useCreateReview>);
  vi.mocked(useMyReview).mockReturnValue({ isLoading: false, data: null } as unknown as ReturnType<typeof useMyReview>);
  Element.prototype.scrollIntoView = vi.fn();
});

const open = (status: string, hash = '', state?: object) => {
  vi.mocked(useBookingDetail).mockReturnValue({ isLoading: false, isError: false, data: booking(status), dataUpdatedAt: Date.now(), refetch: vi.fn() } as unknown as ReturnType<typeof useBookingDetail>);
  renderWithProviders(<BookingDetailPage />, { route: state ? { pathname: `/bookings/5${hash}`, state } : `/bookings/5${hash}` } as never);
};

describe('BookingDetailPage dates', () => {
  it('shows check-in and check-out as dd/mm/yyyy, not raw ISO text', () => {
    open('Đã xác nhận');

    expect(screen.getByText('01/01/2030')).toBeInTheDocument();
    expect(screen.getByText('02/01/2030')).toBeInTheDocument();
    expect(screen.queryByText('2030-01-01')).not.toBeInTheDocument();
  });
});

describe('BookingDetailPage hotel section', () => {
  it('links to the hotel page and builds a map link from the exact address returned by the API', () => {
    open('Đã xác nhận');

    expect(screen.getByRole('link', { name: /Xem thông tin khách sạn/ })).toHaveAttribute('href', '/hotels/1');
    expect(screen.getByRole('link', { name: /Xem trên bản đồ/ })).toHaveAttribute('href', expect.stringContaining('1%20%C4%90%C6%B0%E1%BB%9Dng%20Th%E1%BB%AD%20Nghi%E1%BB%87m'));
  });

  it('renders the hotel cover returned by the booking API', () => {
    open('Đã xác nhận');
    expect(document.querySelector('.booking-detail-page__hotel-image')).toHaveAttribute('src', 'https://images.example.test/hotel-cover.jpg');
  });
});

describe('BookingDetailPage review anchor', () => {
  it('scrolls to the review section when opened with #danh-gia on a completed booking', () => {
    open('Hoàn tất', '#danh-gia');

    const section = document.getElementById('danh-gia');
    expect(section).not.toBeNull();
    expect(screen.getByRole('heading', { name: /Đánh giá/ })).toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledOnce();
    expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts[0]).toBe(section);
  });

  it('does not scroll without the hash', () => {
    open('Hoàn tất');
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('does nothing (and does not fail) when the booking is not reviewable', () => {
    open('Đã xác nhận', '#danh-gia');
    expect(document.getElementById('danh-gia')).toBeNull();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
});

describe('BookingDetailPage payment hold', () => {
  it('shows how long the room is held while the booking waits for payment, without any "success" banner', () => {
    open('Chờ thanh toán');

    expect(screen.getByRole('timer')).toHaveTextContent('10:00');
    expect(screen.queryByText('Đặt phòng thành công!')).not.toBeInTheDocument();
  });

  it('acknowledges a just-created booking without calling it a success', () => {
    open('Chờ thanh toán', '', { justBooked: true });
    expect(screen.getByRole('heading', { name: 'Đã tạo đơn đặt phòng' })).toBeInTheDocument();
  });

  it('keeps the notice after a refresh (it depends on the booking state, not on navigation state)', () => {
    open('Chờ thanh toán');
    expect(screen.getByRole('heading', { name: 'Đơn đang chờ thanh toán' })).toBeInTheDocument();
  });

  it.each(['Đã xác nhận', 'Đã hủy', 'Hoàn tất'])('shows no hold for a %s booking', (status) => {
    open(status);
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });
});

describe('BookingDetailPage refund retry', () => {
  const withRefund = (refundStatus: string) => {
    const base = booking('Đã hủy');
    return {
      ...base,
      ThanhToan: [{
        MaThanhToan: 3, SoTien: 1000000, PhuongThucThanhToan: 'VNPAY', TrangThai: 'Thành công', ThoiGianGiaoDich: '2030-01-01T00:00:00.000Z',
        HoanTien: [{ MaHoanTien: 11, SoTienHoan: 1000000, LyDoHoanTien: 'Hủy', TrangThai: refundStatus, NgayYeuCau: '2030-01-01T00:00:00.000Z', NgayHoanTien: null }],
      }],
    } as unknown as BookingDetail;
  };
  const openWithRefund = (refundStatus: string, retry: object = {}) => {
    vi.mocked(useRetryRefund).mockReturnValue({ ...idle, ...retry } as unknown as ReturnType<typeof useRetryRefund>);
    vi.mocked(useBookingDetail).mockReturnValue({ isLoading: false, isError: false, data: withRefund(refundStatus), dataUpdatedAt: Date.now(), refetch: vi.fn() } as unknown as ReturnType<typeof useBookingDetail>);
    renderWithProviders(<BookingDetailPage />, { route: '/bookings/5' });
  };

  it('retries the SAME refund (by its id) from the failed refund row', async () => {
    const mutate = vi.fn();
    openWithRefund('Thất bại', { mutate });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(mutate).toHaveBeenCalledWith(11);
  });

  it('no retry button once the refund succeeded', () => {
    openWithRefund('Thành công');
    expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument();
  });

  it('waits while a retry is being sent, and says why the server refused one', () => {
    openWithRefund('Chờ xử lý', { isPending: true, isError: true, error: new ApiError('Yêu cầu hoàn tiền đang được xử lý. Vui lòng kiểm tra lại sau ít phút', 409) });
    expect(screen.getByRole('button', { name: /Thử lại/ })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Yêu cầu hoàn tiền đang được xử lý');
  });
});

describe('BookingDetailPage cancelling with a refund (simulated)', () => {
  const paid = (extra: object = {}) =>
    ({
      ...booking('Đã xác nhận'),
      ThanhToan: [{ MaThanhToan: 3, SoTien: 1000000, PhuongThucThanhToan: 'VNPAY (mô phỏng)', TrangThai: 'Thành công', ThoiGianGiaoDich: '2030-01-01T00:00:00.000Z', HoanTien: [] }],
      ...extra,
    }) as unknown as BookingDetail;
  const cancelledWithRefund = (refunds: object[]) => ({ ...paid({ TrangThai: 'Đã hủy' }), ThanhToan: [{ ...paid().ThanhToan[0], HoanTien: refunds }] }) as unknown as BookingDetail;
  const refundRow = (TrangThai: string, SoTienHoan: number) => ({ MaHoanTien: 1, SoTienHoan, LyDoHoanTien: 'Hủy', TrangThai, NgayYeuCau: '2030-01-01T00:00:00.000Z', NgayHoanTien: null });
  const mutateAsync = vi.fn();
  const mutate = vi.fn();

  const openBooking = (data: BookingDetail) => {
    vi.mocked(useCancelBooking).mockReturnValue({ ...idle, mutate, mutateAsync } as unknown as ReturnType<typeof useCancelBooking>);
    vi.mocked(useBookingDetail).mockReturnValue({ isLoading: false, isError: false, data, dataUpdatedAt: Date.now(), refetch: vi.fn() } as unknown as ReturnType<typeof useBookingDetail>);
    renderWithProviders(<BookingDetailPage />, { route: '/bookings/5' });
  };
  const confirmCancel = async () => {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Hủy đặt phòng này' }));
    await user.click(screen.getByRole('button', { name: 'Xác nhận hủy' }));
  };

  beforeEach(() => {
    mutate.mockReset();
    mutateAsync.mockReset();
  });

  it('a paid booking: a processing dialog while the cancellation runs, then the amount that was refunded', async () => {
    let finish: (value: BookingDetail) => void = () => undefined;
    mutateAsync.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    openBooking(paid());

    await confirmCancel();

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Đang xử lý hủy đặt phòng và hoàn tiền');
    expect(mutateAsync).toHaveBeenCalledWith({ ghiChu: undefined });

    finish(cancelledWithRefund([refundRow('Thành công', 1000000)]));

    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent('Hủy đặt phòng thành công'));
    expect(screen.getByRole('dialog')).toHaveTextContent('1.000.000');
    expect(screen.getByRole('dialog')).toHaveTextContent('đã được hoàn về phương thức thanh toán ban đầu');
  });

  it('sends the reason the customer typed', async () => {
    mutateAsync.mockResolvedValue(cancelledWithRefund([refundRow('Thành công', 1000000)]));
    openBooking(paid());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Hủy đặt phòng này' }));
    await user.type(screen.getByLabelText('Lý do hủy (không bắt buộc)'), 'Đổi lịch');

    await user.click(screen.getByRole('button', { name: 'Xác nhận hủy' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ ghiChu: 'Đổi lịch' }));
  });

  it('a refused cancellation is explained in the dialog, which can be closed', async () => {
    mutateAsync.mockRejectedValue(new ApiError('Đặt phòng đã đổi trạng thái trước đó (có thể đã bị hủy hoặc hết hạn) — vui lòng tải lại', 409));
    openBooking(paid());

    await confirmCancel();

    expect(await screen.findByRole('alert')).toHaveTextContent('Đặt phòng đã đổi trạng thái trước đó');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('an unpaid booking is cancelled plainly: no processing dialog, no refund talk', async () => {
    openBooking(booking('Chờ thanh toán'));

    await confirmCancel();

    expect(mutate).toHaveBeenCalledOnce();
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
