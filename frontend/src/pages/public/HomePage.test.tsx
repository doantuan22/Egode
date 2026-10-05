import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from './HomePage';
import { useSearchHotels } from '../../features/hotels/hooks';
import { useLocations } from '../../features/locations/hooks';
import { renderWithProviders } from '../../test/testUtils';

vi.mock('../../features/hotels/hooks');
vi.mock('../../features/locations/hooks');

const hotel = {
  MaKhachSan: 7, TenKhachSan: 'Khách sạn thử', DiaChiChiTiet: '1 Đường thử', HangSao: 4,
  DiaPhuong: { MaDiaPhuong: 1, TenThanhPho: 'Huế', TenTinh: 'Thừa Thiên Huế', QuocGia: 'Việt Nam' }, AnhDaiDien: null, GiaTuDauTu: 500000, ConPhong: true,
};

beforeEach(() => {
  vi.mocked(useSearchHotels).mockReturnValue({ isLoading: false, isError: false, data: { items: [hotel], pagination: { page: 1, limit: 4, total: 1, totalPages: 1 } } } as unknown as ReturnType<typeof useSearchHotels>);
  vi.mocked(useLocations).mockReturnValue({ isLoading: false, isError: false, data: [] } as unknown as ReturnType<typeof useLocations>);
});

describe('HomePage guest count', () => {
  it('uses the same default everywhere: the search box, the featured query and the hotel links', () => {
    renderWithProviders(<HomePage />);

    expect(screen.getByRole('button', { name: /Số khách\s*2 khách/ })).toBeInTheDocument();
    expect(vi.mocked(useSearchHotels).mock.calls[0][0]).toMatchObject({ guests: 2 });
    // the card links to the hotel twice (image and arrow): every one of them carries the guest count
    const links = screen.getAllByRole('link', { name: /Xem phòng tại Khách sạn thử/ });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link.getAttribute('href')).toMatch(/guests=2$/);
  });
});
