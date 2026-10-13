import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminBookingsPage from './AdminBookingsPage';
import { listAdminBookings } from '../../features/admin/bookings/api';
import { renderWithProviders } from '../../test/testUtils';

vi.mock('../../features/admin/bookings/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../features/admin/bookings/api')>();
  return { ...actual, listAdminBookings: vi.fn() };
});

function Probe() {
  return <output data-testid="search">{useLocation().search}</output>;
}

const response = {
  items: [{
    MaDatPhong: 41,
    MaXacNhanDatPhong: 'BK-DEMO-0041',
    KhachHang: { MaTaiKhoan: 7, HoTen: 'Nguyễn Văn An', SoDienThoai: '0900000000' },
    KhachSan: { MaKhachSan: 3, TenKhachSan: 'Egode Riverside' },
    NgayNhanPhong: '2030-01-10',
    NgayTraPhong: '2030-01-12',
    TongSoPhong: 2,
    TongTienThanhToan: 2500000,
    TrangThai: 'Đã xác nhận',
    NgayTao: '2029-12-01T08:00:00.000Z',
  }],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

const open = (search = '') => renderWithProviders(
  <>
    <Routes><Route path="/admin/bookings" element={<AdminBookingsPage />} /></Routes>
    <Probe />
  </>,
  { route: `/admin/bookings${search}` }
);

beforeEach(() => {
  vi.mocked(listAdminBookings).mockReset().mockResolvedValue(response);
});

describe('AdminBookingsPage', () => {
  it('reads filters from the URL and shows system-wide booking rows', async () => {
    open('?search=BK-DEMO&status=Đã+xác+nhận&from=2030-01-01&to=2030-01-31&page=2');

    await screen.findByText('#BK-DEMO-0041');
    expect(listAdminBookings).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
      search: 'BK-DEMO',
      trangThai: 'Đã xác nhận',
      from: '2030-01-01',
      to: '2030-01-31',
    });
    expect(screen.getByRole('link', { name: 'Egode Riverside' })).toHaveAttribute('href', '/admin/hotels/3');
    expect(screen.getByRole('link', { name: /Chi tiết/ })).toHaveAttribute('href', '/admin/bookings/41');
  });

  it('updates status in the URL and returns to page one', async () => {
    open('?page=3');
    await screen.findByText('#BK-DEMO-0041');

    await userEvent.setup().selectOptions(screen.getByLabelText('Trạng thái đặt phòng'), 'Hoàn tất');

    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('status=Ho%C3%A0n+t%E1%BA%A5t'));
    expect(screen.getByTestId('search')).not.toHaveTextContent('page=');
    await waitFor(() => expect(listAdminBookings).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, trangThai: 'Hoàn tất' })));
  });

  it('clears an applied check-in range as one filter', async () => {
    open('?from=2030-01-01&to=2030-01-31');
    await screen.findByText('#BK-DEMO-0041');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Bỏ bộ lọc ngày nhận phòng' }));

    await waitFor(() => expect(screen.getByTestId('search')).toBeEmptyDOMElement());
    expect(screen.getByLabelText('Nhận phòng từ ngày')).toHaveValue('');
    expect(screen.getByLabelText('Nhận phòng đến ngày')).toHaveValue('');
  });
});
