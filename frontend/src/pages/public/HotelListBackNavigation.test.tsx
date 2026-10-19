import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HotelListPage from './HotelListPage';
import HotelDetailPage from './HotelDetailPage';
import { FeedbackProvider } from '../../components/common/FeedbackProvider';
import { useHotelDetail, useHotelRooms, useSearchHotels } from '../../features/hotels/hooks';
import { useAmenities } from '../../features/amenities/hooks';
import { useQuote } from '../../features/quotes/hooks';
import { useCreateBooking } from '../../features/bookings/hooks';
import { useLocations } from '../../features/locations/hooks';
import { useHotelReviews } from '../../features/reviews/hooks';
import { useAvailablePromotions } from '../../features/promotions/hooks';
import { renderWithProviders } from '../../test/testUtils';

vi.mock('../../features/hotels/hooks');
vi.mock('../../features/amenities/hooks');
vi.mock('../../features/quotes/hooks');
vi.mock('../../features/bookings/hooks');
vi.mock('../../features/locations/hooks');
vi.mock('../../features/reviews/hooks');
vi.mock('../../features/promotions/hooks');
vi.mock('../../lib/share');

const hotelItem = { MaKhachSan: 1, TenKhachSan: 'Khách sạn thử', HangSao: 4, DiaChiChiTiet: '1 Đường thử', DiaPhuong: { MaDiaPhuong: 1, TenThanhPho: 'Hà Nội', TenTinh: 'Hà Nội', QuocGia: 'Việt Nam' }, AnhDaiDien: null, GiaTuDauTu: 500000, ConPhong: true, DiemTrungBinh: null, SoLuongDanhGia: 0 };
const detail = { MaKhachSan: 1, TenKhachSan: 'Khách sạn thử', HangSao: 4, DiaChiChiTiet: '1 Đường thử', MoTa: 'Mô tả', HinhAnh: [], TienNghi: [] };
const idle = { mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, data: undefined, variables: undefined };
const lastListParams = () => vi.mocked(useSearchHotels).mock.calls.at(-1)?.[0];

const FILTERED = '/hotels?location=H%C3%A0%20N%E1%BB%99i&checkIn=2030-01-01&checkOut=2030-01-03&guests=3&minPrice=500000&maxPrice=2000000&starRating=4&amenities=2,3&keyword=view&sort=price_desc&page=2';

beforeEach(() => {
  vi.mocked(useSearchHotels).mockReturnValue({ isLoading: false, isError: false, isFetching: false, isSuccess: true, data: { items: [hotelItem], pagination: { page: 2, limit: 12, total: 13, totalPages: 2 } } } as unknown as ReturnType<typeof useSearchHotels>);
  vi.mocked(useAmenities).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useAmenities>);
  vi.mocked(useHotelDetail).mockReturnValue({ isLoading: false, isError: false, data: detail } as unknown as ReturnType<typeof useHotelDetail>);
  vi.mocked(useHotelRooms).mockReturnValue({ isLoading: false, isError: false, isFetching: false, data: [] } as unknown as ReturnType<typeof useHotelRooms>);
  vi.mocked(useQuote).mockReturnValue({ data: undefined, isLoading: false, isFetching: false, isError: false, error: null } as unknown as ReturnType<typeof useQuote>);
  vi.mocked(useCreateBooking).mockReturnValue(idle as unknown as ReturnType<typeof useCreateBooking>);
  vi.mocked(useLocations).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useLocations>);
  vi.mocked(useHotelReviews).mockReturnValue({ isLoading: false, isError: false, data: { items: [], summary: { DiemTrungBinh: null, SoLuongDanhGia: 0 }, pagination: { page: 1, limit: 5, total: 0, totalPages: 1 } } } as unknown as ReturnType<typeof useHotelReviews>);
  vi.mocked(useAvailablePromotions).mockReturnValue({ isLoading: false, isError: false, data: [] } as unknown as ReturnType<typeof useAvailablePromotions>);
  Element.prototype.scrollIntoView = vi.fn();
});

const open = (route: string) =>
  renderWithProviders(
    <FeedbackProvider>
      <Routes>
        <Route path="/hotels" element={<HotelListPage />} />
        <Route path="/hotels/:id" element={<HotelDetailPage />} />
      </Routes>
    </FeedbackProvider>,
    { route }
  );

const EXPECTED = { location: 'Hà Nội', checkIn: '2030-01-01', checkOut: '2030-01-03', guests: 3, minPrice: 500000, maxPrice: 2000000, starRating: 4, amenities: [2, 3], keyword: 'view', sort: 'price_desc', page: 2 };

describe('back to the hotel list keeps what the list was showing', () => {
  it('"Danh sách khách sạn" restores location, filters, sort and page', async () => {
    const user = userEvent.setup();
    open(FILTERED);
    expect(lastListParams()).toMatchObject(EXPECTED);

    await user.click(screen.getByRole('link', { name: 'Khách sạn thử' }));
    expect(screen.queryByRole('button', { name: 'Danh sách khách sạn' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Danh sách khách sạn' }));
    expect(lastListParams()).toMatchObject(EXPECTED);
  });

  it('the breadcrumb "Khách sạn" link restores them too', async () => {
    const user = userEvent.setup();
    open(FILTERED);
    await user.click(screen.getByRole('link', { name: 'Khách sạn thử' }));

    await user.click(screen.getByRole('link', { name: 'Khách sạn' }));
    expect(lastListParams()).toMatchObject(EXPECTED);
  });

  it('survives a trip through the hotel page more than once', async () => {
    const user = userEvent.setup();
    open(FILTERED);
    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByRole('link', { name: 'Khách sạn thử' }));
      await user.click(screen.getByRole('button', { name: 'Danh sách khách sạn' }));
      expect(lastListParams()).toMatchObject(EXPECTED);
    }
  });

  it('a direct link to a hotel (no list behind it) goes back to the list with the stay from the link', async () => {
    const user = userEvent.setup();
    open('/hotels/1?checkIn=2030-02-01&checkOut=2030-02-04&guests=5');

    await user.click(screen.getByRole('button', { name: 'Danh sách khách sạn' }));
    expect(lastListParams()).toMatchObject({ checkIn: '2030-02-01', checkOut: '2030-02-04', guests: 5, location: undefined, starRating: undefined, amenities: undefined });
  });

  it('a list opened with no filters at all comes back with no filters', async () => {
    const user = userEvent.setup();
    open('/hotels?checkIn=2030-01-01&checkOut=2030-01-03&guests=2');
    await user.click(screen.getByRole('link', { name: 'Khách sạn thử' }));

    await user.click(screen.getByRole('button', { name: 'Danh sách khách sạn' }));
    expect(lastListParams()).toMatchObject({ checkIn: '2030-01-01', checkOut: '2030-01-03', guests: 2, location: undefined, minPrice: undefined, starRating: undefined, amenities: undefined, page: 1 });
  });
});
