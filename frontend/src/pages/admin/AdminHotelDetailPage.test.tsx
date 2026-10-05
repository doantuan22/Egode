import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminHotelDetailPage from './AdminHotelDetailPage';
import * as hotelsApi from '../../features/admin/hotels/api';
import { FeedbackProvider } from '../../components/common/FeedbackProvider';
import { renderWithProviders } from '../../test/testUtils';

vi.mock('../../features/admin/hotels/api');

const hotel = (TrangThai: string) => ({
  MaKhachSan: 7,
  TenKhachSan: 'Khách sạn thử',
  DiaChiChiTiet: '1 Đường Thử',
  HangSao: 3,
  MoTa: null,
  TrangThai,
  MaDiaPhuong: 1,
  DIA_PHUONG: { TenThanhPho: 'Hà Nội' },
});

const open = async (TrangThai: string) => {
  vi.mocked(hotelsApi.getAdminHotel).mockResolvedValue(hotel(TrangThai));
  renderWithProviders(
    <FeedbackProvider>
      <Routes><Route path="/admin/hotels/:id" element={<AdminHotelDetailPage />} /></Routes>
    </FeedbackProvider>,
    { route: '/admin/hotels/7' }
  );
  await screen.findByRole('heading', { name: 'Khách sạn thử' });
};

const button = (name: RegExp) => screen.queryByRole('button', { name });

beforeEach(() => {
  vi.resetAllMocks();
});

describe('AdminHotelDetailPage shows only the action that fits the hotel state', () => {
  it('"Chờ duyệt": approve and reject, never "Kích hoạt lại"', async () => {
    await open('Chờ duyệt');
    expect(button(/Duyệt khách sạn/)).toBeInTheDocument();
    expect(button(/^Từ chối/)).toBeInTheDocument();
    expect(button(/Kích hoạt lại/)).not.toBeInTheDocument();
    expect(button(/đình chỉ/i)).not.toBeInTheDocument();
  });

  it('"Hoạt động": only suspend', async () => {
    await open('Hoạt động');
    expect(button(/Tạm đình chỉ/)).toBeInTheDocument();
    expect(button(/Duyệt khách sạn/)).not.toBeInTheDocument();
    expect(button(/Kích hoạt lại/)).not.toBeInTheDocument();
  });

  it('"Đình chỉ": only reactivate', async () => {
    await open('Đình chỉ');
    expect(button(/Kích hoạt lại/)).toBeInTheDocument();
    expect(button(/Duyệt khách sạn/)).not.toBeInTheDocument();
    expect(button(/Tạm đình chỉ/)).not.toBeInTheDocument();
  });

  it.each(['Từ chối', 'Ngừng hoạt động'])('"%s": no status action at all (an admin cannot activate it)', async (state) => {
    await open(state);
    expect(button(/Duyệt khách sạn/)).not.toBeInTheDocument();
    expect(button(/Kích hoạt lại/)).not.toBeInTheDocument();
    expect(button(/Tạm đình chỉ/)).not.toBeInTheDocument();
    expect(screen.getByText(/Không có thao tác nào khả dụng/)).toBeInTheDocument();
  });

  it('approving calls the approve endpoint — not reactivate', async () => {
    vi.mocked(hotelsApi.approveAdminHotel).mockResolvedValue(hotel('Hoạt động'));
    await open('Chờ duyệt');

    await userEvent.click(button(/Duyệt khách sạn/)!);
    await userEvent.click(await screen.findByRole('button', { name: 'Duyệt' }));

    await waitFor(() => expect(hotelsApi.approveAdminHotel).toHaveBeenCalledWith(7));
    expect(hotelsApi.reactivateAdminHotel).not.toHaveBeenCalled();
  });
});

describe('AdminHotelDetailPage check-in / check-out time ("HH:mm", same contract as the owner)', () => {
  const openWithTimes = async (GioNhanPhong?: string, GioTraPhong?: string) => {
    vi.mocked(hotelsApi.getAdminHotel).mockResolvedValue({ ...hotel('Hoạt động'), GioNhanPhong, GioTraPhong });
    renderWithProviders(
      <FeedbackProvider>
        <Routes><Route path="/admin/hotels/:id" element={<AdminHotelDetailPage />} /></Routes>
      </FeedbackProvider>,
      { route: '/admin/hotels/7' }
    );
    await screen.findByRole('heading', { name: 'Khách sạn thử' });
  };

  it('shows the stored "HH:mm" in the two time inputs', async () => {
    await openWithTimes('02:30', '11:15');
    expect(screen.getByLabelText(/Giờ nhận phòng/)).toHaveValue('02:30');
    expect(screen.getByLabelText(/Giờ trả phòng/)).toHaveValue('11:15');
  });

  it('saves them as the same "HH:mm" strings — never a Date/ISO value', async () => {
    vi.mocked(hotelsApi.updateAdminHotel).mockResolvedValue({ ...hotel('Hoạt động'), GioNhanPhong: '15:00', GioTraPhong: '11:15' });
    await openWithTimes('14:00', '12:00');
    const user = userEvent.setup();

    fireEvent.change(screen.getByLabelText(/Giờ nhận phòng/), { target: { value: '15:00' } });
    fireEvent.change(screen.getByLabelText(/Giờ trả phòng/), { target: { value: '11:15' } });
    await user.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));

    await waitFor(() => expect(hotelsApi.updateAdminHotel).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(hotelsApi.updateAdminHotel).mock.calls[0][1];
    expect(payload).toMatchObject({ GioNhanPhong: '15:00', GioTraPhong: '11:15' });
    expect(payload.GioNhanPhong).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
  });
});
