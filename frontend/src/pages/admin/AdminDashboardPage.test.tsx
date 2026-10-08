import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminDashboardPage from './AdminDashboardPage';
import { useAdminAnalytics } from '../../features/analytics/hooks';
import { useAdminPartnerApplications } from '../../features/partners/hooks';
import { renderWithProviders } from '../../test/testUtils';

vi.mock('../../features/analytics/hooks');
vi.mock('../../features/partners/hooks');

const analytics = {
  TongTaiKhoan: 12,
  TongSoBooking: 34,
  DoanhThuThucNhan: 1000000,
  KhachSanTheoTrangThai: [{ Label: 'Hoạt động', SoLuong: 5 }],
  YeuCauHoTroTheoTrangThai: [{ Label: 'Mới', SoLuong: 3 }],
  DanhGiaTheoTrangThai: [{ Label: 'Chờ duyệt', SoLuong: 2 }, { Label: 'Vi phạm', SoLuong: 1 }],
};

beforeEach(() => {
  vi.mocked(useAdminAnalytics).mockReturnValue({ isLoading: false, isError: false, data: analytics } as unknown as ReturnType<typeof useAdminAnalytics>);
  vi.mocked(useAdminPartnerApplications).mockReturnValue({
    data: { items: [{}], pagination: { page: 1, limit: 1, total: 137, totalPages: 137 } },
  } as unknown as ReturnType<typeof useAdminPartnerApplications>);
});

describe('AdminDashboardPage', () => {
  it('counts pending partner applications from the server total, not from the rows it fetched', () => {
    renderWithProviders(<AdminDashboardPage />);

    expect(vi.mocked(useAdminPartnerApplications)).toHaveBeenCalledWith('Chờ duyệt', 1, 1);
    expect(screen.getByRole('link', { name: /Hồ sơ đối tác chờ duyệt/ })).toHaveTextContent('137');
  });

  it('opens each queue already filtered to what is waiting', () => {
    renderWithProviders(<AdminDashboardPage />);

    expect(screen.getByRole('link', { name: /Đánh giá vi phạm chưa gỡ/ })).toHaveAttribute('href', '/admin/reviews?status=Vi phạm');
    expect(screen.getByRole('link', { name: /Yêu cầu hỗ trợ mới/ })).toHaveAttribute('href', '/admin/support?status=Mới');
  });

  it('shows the overview figures and has a single h1', () => {
    renderWithProviders(<AdminDashboardPage />);

    expect(screen.getByText('Khách sạn hoạt động').closest('article')).toHaveTextContent('5');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('shows the error from the API instead of the figures', () => {
    vi.mocked(useAdminAnalytics).mockReturnValue({ isLoading: false, isError: true, data: undefined, error: new Error('x') } as unknown as ReturnType<typeof useAdminAnalytics>);
    renderWithProviders(<AdminDashboardPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('Không thể tải số liệu tổng quan');
  });
});
