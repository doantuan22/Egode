import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OwnerInventoryPricingPage from './OwnerInventoryPricingPage';
import { FeedbackProvider } from '../../components/common/FeedbackProvider';
import { useBulkUpsertRates, useMyHotels, useRates, useRoomTypes } from '../../features/owner/hooks';
import { renderWithProviders } from '../../test/testUtils';

vi.mock('../../features/owner/hooks');

const mutateAsync = vi.fn();

beforeEach(() => {
  mutateAsync.mockReset().mockResolvedValue([]);
  vi.mocked(useMyHotels).mockReturnValue({ isLoading: false, data: [{ MaKhachSan: 1, TenKhachSan: 'Khách sạn thử' }] } as unknown as ReturnType<typeof useMyHotels>);
  vi.mocked(useRoomTypes).mockReturnValue({ isLoading: false, isError: false, data: [{ MaLoaiPhong: 11, TenLoaiPhong: 'Phòng Superior' }] } as unknown as ReturnType<typeof useRoomTypes>);
  vi.mocked(useRates).mockReturnValue({ isLoading: false, isError: false, data: [] } as unknown as ReturnType<typeof useRates>);
  vi.mocked(useBulkUpsertRates).mockReturnValue({ mutateAsync, isPending: false } as unknown as ReturnType<typeof useBulkUpsertRates>);
});

const open = () =>
  renderWithProviders(
    <Routes>
      <Route path="/owner/inventory-pricing" element={<FeedbackProvider><OwnerInventoryPricingPage /></FeedbackProvider>} />
    </Routes>,
    { route: '/owner/inventory-pricing?hotelId=1&roomTypeId=11' }
  );

// 2030-01-01 is a Tuesday: 2030-01-01..2030-01-14 has two Mondays (01-07, 01-14).
const fillRange = async (user: ReturnType<typeof userEvent.setup>) => {
  const from = screen.getByLabelText('Từ ngày');
  const to = screen.getByLabelText('Đến ngày');
  await user.clear(from);
  await user.type(from, '2030-01-01');
  await user.clear(to);
  await user.type(to, '2030-01-14');
  await user.type(screen.getByLabelText('Giá phòng'), '700000');
  await user.type(screen.getByLabelText('Số lượng phòng'), '5');
};

describe('OwnerInventoryPricingPage bulk update', () => {
  it('asks before overwriting the range, and changes nothing when the owner goes back', async () => {
    open();
    const user = userEvent.setup();
    await fillRange(user);

    await user.click(screen.getByRole('button', { name: 'Cập nhật thông tin' }));

    expect(await screen.findByText('Ghi đè giá và quỹ phòng?')).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/14 ngày/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Phòng Superior/)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Quay lại' }));

    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('sends the rows once the owner confirms, and says it was done', async () => {
    open();
    const user = userEvent.setup();
    await fillRange(user);
    await user.click(screen.getByRole('button', { name: 'Cập nhật thông tin' }));

    await user.click(await screen.findByRole('button', { name: 'Ghi đè' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(mutateAsync.mock.calls[0][0]).toHaveLength(14);
    expect(mutateAsync.mock.calls[0][0][0]).toEqual({ NgayApDung: '2030-01-01', GiaPhong: 700000, SoLuongPhong: 5, TrangThai: 'Mở bán' });
    expect(await screen.findByText('Đã cập nhật giá và quỹ phòng')).toBeInTheDocument();
  });

  it('can apply the change to selected weekdays only', async () => {
    open();
    const user = userEvent.setup();
    await fillRange(user);
    // Everything is ticked by default: leave only Monday.
    for (const day of ['T3', 'T4', 'T5', 'T6', 'T7', 'CN']) await user.click(screen.getByRole('checkbox', { name: day }));

    await user.click(screen.getByRole('button', { name: 'Cập nhật thông tin' }));
    expect(await screen.findByText(/2 ngày/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ghi đè' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(mutateAsync.mock.calls[0][0].map((row: { NgayApDung: string }) => row.NgayApDung)).toEqual(['2030-01-07', '2030-01-14']);
  });

  it('refuses to send anything when no weekday is ticked', async () => {
    open();
    const user = userEvent.setup();
    await fillRange(user);
    for (const day of ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']) await user.click(screen.getByRole('checkbox', { name: day }));

    await user.click(screen.getByRole('button', { name: 'Cập nhật thông tin' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Chọn ít nhất một thứ trong tuần');
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});

describe('OwnerInventoryPricingPage status-only change', () => {
  const pickRange = async (user: ReturnType<typeof userEvent.setup>) => {
    const from = screen.getByLabelText('Từ ngày');
    const to = screen.getByLabelText('Đến ngày');
    await user.clear(from);
    await user.type(from, '2030-01-01');
    await user.clear(to);
    await user.type(to, '2030-01-04');
  };

  it('closes days without asking for a price or quantity, sending only the days that already have a rate and the new status', async () => {
    vi.mocked(useRates).mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        { MaQuyPhong: 1, MaLoaiPhong: 11, NgayApDung: '2030-01-02T00:00:00.000Z', GiaPhong: 600000, SoLuongPhong: 3, TrangThai: 'Mở bán' },
        { MaQuyPhong: 2, MaLoaiPhong: 11, NgayApDung: '2030-01-03T00:00:00.000Z', GiaPhong: 600000, SoLuongPhong: 3, TrangThai: 'Mở bán' },
      ],
    } as unknown as ReturnType<typeof useRates>);
    open();
    const user = userEvent.setup();
    await pickRange(user);
    await user.selectOptions(screen.getByLabelText('Trạng thái'), 'Đóng bán');

    await user.click(screen.getByRole('button', { name: 'Cập nhật thông tin' }));

    expect(await screen.findByText('Đổi trạng thái bán?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(mutateAsync.mock.calls[0][0]).toEqual([
      { NgayApDung: '2030-01-02', TrangThai: 'Đóng bán' },
      { NgayApDung: '2030-01-03', TrangThai: 'Đóng bán' },
    ]);
  });

  it('explains what to do when none of the chosen days has a rate yet, and sends nothing', async () => {
    open();
    const user = userEvent.setup();
    await pickRange(user);
    await user.selectOptions(screen.getByLabelText('Trạng thái'), 'Đóng bán');

    await user.click(screen.getByRole('button', { name: 'Cập nhật thông tin' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('chưa có giá/quỹ phòng');
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
