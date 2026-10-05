import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HotelListPage from './HotelListPage';
import { useSearchHotels } from '../../features/hotels/hooks';
import { useAmenities } from '../../features/amenities/hooks';
import { useLocations } from '../../features/locations/hooks';
import { renderWithProviders } from '../../test/testUtils';

vi.mock('../../features/hotels/hooks');
vi.mock('../../features/amenities/hooks');
vi.mock('../../features/locations/hooks');

beforeEach(() => {
  vi.mocked(useSearchHotels).mockReturnValue({ isLoading: false, isError: false, isFetching: false, data: { items: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } } } as unknown as ReturnType<typeof useSearchHotels>);
  vi.mocked(useAmenities).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useAmenities>);
  vi.mocked(useLocations).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useLocations>);
});

const lastParams = () => vi.mocked(useSearchHotels).mock.calls.at(-1)?.[0];

describe('HotelListPage guest count', () => {
  it('searches for the default number of guests when the link has none, and shows it in the search box', () => {
    renderWithProviders(<HotelListPage />, { route: '/hotels' });

    expect(lastParams()).toMatchObject({ guests: 2 });
    // shown in the search box (the 'Số khách' control) AND repeated in the results summary chip
    expect(screen.getByRole('button', { name: /Số khách\s*2 khách/ })).toBeInTheDocument();
    expect(screen.getAllByText('2 khách')).toHaveLength(2);
  });

  it('keeps the guest count from the link', () => {
    renderWithProviders(<HotelListPage />, { route: '/hotels?guests=4' });

    expect(lastParams()).toMatchObject({ guests: 4 });
  });

  it('treats an invalid guest count in the link as the default', () => {
    renderWithProviders(<HotelListPage />, { route: '/hotels?guests=abc' });

    expect(lastParams()).toMatchObject({ guests: 2 });
  });
});
