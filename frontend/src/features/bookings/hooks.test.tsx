import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateBooking } from './hooks';
import * as bookingsApi from './api';
import type { Booking, CreateBookingRequest } from './types';

vi.mock('./api');

const request = {
  checkIn: '2030-01-01',
  checkOut: '2030-01-02',
  rooms: [{ maLoaiPhong: 1, soLuong: 1 }],
} as CreateBookingRequest;

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  // Người dùng đã mở danh sách và một chi tiết đơn
  queryClient.setQueryData(['bookings'], []);
  queryClient.setQueryData(['bookings', 7], { MaDatPhong: 7 });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { queryClient, ...renderHook(() => useCreateBooking(10), { wrapper }) };
}

describe('useCreateBooking', () => {
  beforeEach(() => {
    vi.mocked(bookingsApi.createBooking).mockReset();
  });

  it('marks the cached booking list and details stale after a booking is created', async () => {
    vi.mocked(bookingsApi.createBooking).mockResolvedValue({ MaDatPhong: 99 } as Booking);
    const { queryClient, result } = setup();

    result.current.mutate(request);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryState(['bookings'])?.isInvalidated).toBe(true);
    // Khóa chi tiết cũng bị vô hiệu theo tiền tố
    expect(queryClient.getQueryState(['bookings', 7])?.isInvalidated).toBe(true);
  });

  it('leaves the cache untouched when creating the booking fails', async () => {
    vi.mocked(bookingsApi.createBooking).mockRejectedValue(new Error('Hết phòng'));
    const { queryClient, result } = setup();

    result.current.mutate(request);
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(queryClient.getQueryState(['bookings'])?.isInvalidated).toBe(false);
  });
});
