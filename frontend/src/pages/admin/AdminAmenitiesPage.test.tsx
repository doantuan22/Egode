import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminAmenitiesPage from './AdminAmenitiesPage';
import * as hotelsApi from '../../features/admin/hotels/api';
import { FeedbackProvider } from '../../components/common/FeedbackProvider';
import { renderWithProviders } from '../../test/testUtils';

vi.mock('../../features/admin/hotels/api');

const wifi = { MaTienNghi: 1, TenTienNghi: 'Wi-Fi', BieuTuong: 'wifi', SoKhachSan: 0, SoLoaiPhong: 0 };
const pool = { MaTienNghi: 2, TenTienNghi: 'Hồ bơi', BieuTuong: null, SoKhachSan: 3, SoLoaiPhong: 1 };

const open = async () => {
  vi.mocked(hotelsApi.listAdminAmenities).mockResolvedValue([wifi, pool]);
  renderWithProviders(<FeedbackProvider><AdminAmenitiesPage /></FeedbackProvider>, { route: '/admin/hotels/amenities' });
  await screen.findByText('Wi-Fi');
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('AdminAmenitiesPage', () => {
  it('adds an amenity, trimming the name and sending a null icon when left empty', async () => {
    vi.mocked(hotelsApi.createAdminAmenity).mockResolvedValue({ ...wifi, MaTienNghi: 9, TenTienNghi: 'Sân golf' });
    await open();

    await userEvent.type(screen.getByLabelText(/Tên tiện nghi/), '  Sân golf ');
    await userEvent.click(screen.getByRole('button', { name: /Thêm tiện nghi/ }));

    await waitFor(() => expect(hotelsApi.createAdminAmenity).toHaveBeenCalledWith({ TenTienNghi: 'Sân golf', BieuTuong: null }));
  });

  it('edits an amenity through the same form', async () => {
    vi.mocked(hotelsApi.updateAdminAmenity).mockResolvedValue({ ...wifi, TenTienNghi: 'Wi-Fi tốc độ cao' });
    await open();

    await userEvent.click(screen.getByRole('button', { name: 'Sửa tiện nghi Wi-Fi' }));
    const name = screen.getByLabelText(/Tên tiện nghi/);
    expect(name).toHaveValue('Wi-Fi');
    await userEvent.clear(name);
    await userEvent.type(name, 'Wi-Fi tốc độ cao');
    await userEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));

    await waitFor(() => expect(hotelsApi.updateAdminAmenity).toHaveBeenCalledWith(1, { TenTienNghi: 'Wi-Fi tốc độ cao', BieuTuong: 'wifi' }));
    expect(hotelsApi.createAdminAmenity).not.toHaveBeenCalled();
  });

  it('deletes an unused amenity after confirmation', async () => {
    vi.mocked(hotelsApi.deleteAdminAmenity).mockResolvedValue();
    await open();

    await userEvent.click(screen.getByRole('button', { name: 'Xóa tiện nghi Wi-Fi' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Xóa' }));

    await waitFor(() => expect(hotelsApi.deleteAdminAmenity).toHaveBeenCalledWith(1));
  });

  it('does not call delete for an amenity that hotels or room types still use', async () => {
    await open();

    await userEvent.click(screen.getByRole('button', { name: 'Xóa tiện nghi Hồ bơi' }));

    expect(await screen.findByText('Tiện nghi đang được sử dụng')).toBeInTheDocument();
    expect(hotelsApi.deleteAdminAmenity).not.toHaveBeenCalled();
  });
});
