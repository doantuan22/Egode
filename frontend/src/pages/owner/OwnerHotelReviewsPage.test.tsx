import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OwnerHotelReviewsPage from './OwnerHotelReviewsPage';
import { useMyHotel, useOwnerHotelReviews } from '../../features/owner/hooks';
import { renderWithProviders } from '../../test/testUtils';

vi.mock('../../features/owner/hooks');

const page = {
  items: [
    { MaDanhGia: 2, DiemDanhGia: 5, NoiDung: 'Phòng sạch, nhân viên thân thiện', TenNguoiDanhGia: 'Nguyễn V. A.', HinhAnh: ['https://img.test/1.jpg'], NgayNhanPhong: '2026-05-01', NgayTraPhong: '2026-05-03' },
    { MaDanhGia: 1, DiemDanhGia: 3, NoiDung: null, TenNguoiDanhGia: 'T***', HinhAnh: [], NgayNhanPhong: '2026-04-01', NgayTraPhong: '2026-04-02' },
  ],
  pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
  summary: { DiemTrungBinh: 4, SoLuongDanhGia: 2, PhanBoDiem: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 } },
};

function Probe() {
  return <output data-testid="search">{useLocation().search}</output>;
}

const open = (search = '') =>
  renderWithProviders(
    <>
      <Routes><Route path="/owner/hotels/:hotelId/reviews" element={<OwnerHotelReviewsPage />} /></Routes>
      <Probe />
    </>,
    { route: `/owner/hotels/7/reviews${search}` }
  );

beforeEach(() => {
  vi.mocked(useMyHotel).mockReturnValue({ isLoading: false, isError: false, data: { TenKhachSan: 'Khách sạn Biển' } } as unknown as ReturnType<typeof useMyHotel>);
  vi.mocked(useOwnerHotelReviews).mockReset();
  vi.mocked(useOwnerHotelReviews).mockReturnValue({ isLoading: false, isError: false, data: page } as unknown as ReturnType<typeof useOwnerHotelReviews>);
});

describe('OwnerHotelReviewsPage', () => {
  it('shows the summary, the distribution and each review with the stay dates', () => {
    open();

    expect(screen.getByRole('heading', { level: 1, name: 'Đánh giá của khách' })).toBeInTheDocument();
    expect(screen.getByText('2 đánh giá')).toBeInTheDocument();
    expect(screen.getByText('4.0')).toBeInTheDocument();
    expect(screen.getByText('Phòng sạch, nhân viên thân thiện')).toBeInTheDocument();
    expect(screen.getByText('Nguyễn V. A.')).toBeInTheDocument();
    expect(screen.getByText('Khách chỉ chấm điểm, không viết nhận xét.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Quay lại Khách sạn Biển/ })).toHaveAttribute('href', '/owner/hotels/7');
    expect(vi.mocked(useOwnerHotelReviews)).toHaveBeenLastCalledWith(7, 1, 10, undefined);
  });

  it('filters by stars through the URL and asks the API for that score only', async () => {
    open();

    await userEvent.setup().click(screen.getByRole('button', { name: '5 sao (1)' }));

    expect(screen.getByTestId('search')).toHaveTextContent('rating=5');
    expect(vi.mocked(useOwnerHotelReviews)).toHaveBeenLastCalledWith(7, 1, 10, 5);
    expect(screen.getByRole('button', { name: '5 sao (1)' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('starts from the filter in the link and ignores a nonsense value', () => {
    open('?rating=4');
    expect(vi.mocked(useOwnerHotelReviews)).toHaveBeenLastCalledWith(7, 1, 10, 4);

    open('?rating=99');
    expect(vi.mocked(useOwnerHotelReviews)).toHaveBeenLastCalledWith(7, 1, 10, undefined);
  });

  it('says so when the hotel has no reviews yet', () => {
    vi.mocked(useOwnerHotelReviews).mockReturnValue({
      isLoading: false, isError: false,
      data: { items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 }, summary: { DiemTrungBinh: null, SoLuongDanhGia: 0, PhanBoDiem: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } } },
    } as unknown as ReturnType<typeof useOwnerHotelReviews>);
    open();

    expect(screen.getByText('Chưa có đánh giá nào')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows the API error instead of an empty list', () => {
    vi.mocked(useOwnerHotelReviews).mockReturnValue({ isLoading: false, isError: true, data: undefined, error: new Error('x') } as unknown as ReturnType<typeof useOwnerHotelReviews>);
    open();

    expect(screen.getByRole('alert')).toHaveTextContent('Không thể tải đánh giá');
  });
});
