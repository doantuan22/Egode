import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HotelReviews } from './HotelReviews';
import { HotelCard } from '../HotelCard';
import { useHotelReviews } from '../../../features/reviews/hooks';
import { ApiError } from '../../../services/apiClient';
import { renderWithProviders } from '../../../test/testUtils';
import type { HotelSearchItem } from '../../../features/hotels/types';

vi.mock('../../../features/reviews/hooks');

const review = (id: number, over: object = {}) => ({ MaDanhGia: id, DiemDanhGia: 4, NoiDung: `Nhận xét ${id}`, TenNguoiDanhGia: 'Nguyễn V. A.', HinhAnh: [], ...over });
const page = (items: object[], total: number, totalPages = 1) => ({
  items,
  summary: { DiemTrungBinh: 4.5, SoLuongDanhGia: total },
  pagination: { page: 1, limit: 5, total, totalPages },
});
const mock = (patch: object) => vi.mocked(useHotelReviews).mockReturnValue({ isLoading: false, isError: false, error: null, data: undefined, ...patch } as unknown as ReturnType<typeof useHotelReviews>);

beforeEach(() => vi.mocked(useHotelReviews).mockReset());

describe('HotelReviews', () => {
  it('shows the average, the count and each review with the abbreviated reviewer name', () => {
    mock({ data: page([review(1), review(2, { NoiDung: null })], 2) });
    renderWithProviders(<HotelReviews hotelId={7} />);

    expect(screen.getByRole('heading', { name: 'Đánh giá của khách' })).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText(/2 đánh giá/)).toBeInTheDocument();
    expect(screen.getAllByText('Nguyễn V. A.')).toHaveLength(2);
    expect(screen.getByText('Nhận xét 1')).toBeInTheDocument();
    expect(useHotelReviews).toHaveBeenCalledWith(7, 1, 5);
  });

  it('says so when there are no visible reviews, and offers no pagination', () => {
    mock({ data: { ...page([], 0), summary: { DiemTrungBinh: null, SoLuongDanhGia: 0 } } });
    renderWithProviders(<HotelReviews hotelId={7} />);
    expect(screen.getByText('Chưa có đánh giá nào cho khách sạn này.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Phân trang' })).not.toBeInTheDocument();
  });

  it('pages through the reviews', async () => {
    mock({ data: page([review(1)], 12, 3) });
    renderWithProviders(<HotelReviews hotelId={7} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Sau' }));

    expect(useHotelReviews).toHaveBeenLastCalledWith(7, 2, 5);
  });

  it('shows the server message when the reviews cannot be loaded', () => {
    mock({ isError: true, error: new ApiError('Không tìm thấy khách sạn', 404) });
    renderWithProviders(<HotelReviews hotelId={7} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Không tìm thấy khách sạn');
  });
});

describe('HotelCard rating', () => {
  const hotel = (over: Partial<HotelSearchItem>): HotelSearchItem => ({
    MaKhachSan: 1, TenKhachSan: 'Khách sạn thử', DiaChiChiTiet: 'x', HangSao: 4,
    DiaPhuong: { MaDiaPhuong: 1, TenThanhPho: 'Hà Nội', TenTinh: 'Hà Nội', QuocGia: 'Việt Nam' },
    AnhDaiDien: null, GiaTuDauTu: 500000, ConPhong: true, ...over,
  });

  it('shows the average and count when the hotel has visible reviews', () => {
    renderWithProviders(<HotelCard hotel={hotel({ DiemTrungBinh: 4.2, SoLuongDanhGia: 9 })} search="" />);
    expect(screen.getByText('4.2')).toBeInTheDocument();
    expect(screen.getByText(/9 đánh giá/)).toBeInTheDocument();
  });

  it('shows nothing when there is none', () => {
    renderWithProviders(<HotelCard hotel={hotel({ DiemTrungBinh: null, SoLuongDanhGia: 0 })} search="" />);
    expect(screen.queryByText(/đánh giá/)).not.toBeInTheDocument();
  });
});
