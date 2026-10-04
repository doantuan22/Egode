import { screen, waitFor } from '@testing-library/react';
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
