import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import * as api from './api';
import { useDeactivateRoomType, useReactivateRoomType } from './hooks';
import type { OwnerRoomType } from './types';

vi.mock('./api');

/** Kết quả ngừng hoặc bán lại chỉ có dòng trần không được thay cache */
const full = { MaLoaiPhong: 11, MaKhachSan: 1, TrangThai: 'Ngừng bán', LOAI_PHONG_TIEN_NGHI: [{ MaTienNghi: 1 }], HINH_ANH_LOAI_PHONG: [], KHACH_SAN: { TenKhachSan: 'A' } } as unknown as OwnerRoomType;
const bare = { MaLoaiPhong: 11, MaKhachSan: 1, TrangThai: 'Hoạt động' } as unknown as OwnerRoomType;

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['owner', 'room-types', 11], full);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe('stopping / resuming sales keeps the cached room type whole', () => {
  it('reactivate: the status changes, amenities / images / hotel stay', async () => {
    vi.mocked(api.reactivateRoomType).mockResolvedValue(bare);
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useReactivateRoomType(11), { wrapper });

    await act(async () => { result.current.mutate(); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = client.getQueryData<OwnerRoomType>(['owner', 'room-types', 11])!;
    expect(cached.TrangThai).toBe('Hoạt động');
    expect(cached.LOAI_PHONG_TIEN_NGHI).toHaveLength(1);
    expect(cached.KHACH_SAN?.TenKhachSan).toBe('A');
  });

  it('deactivate: same', async () => {
    vi.mocked(api.deactivateRoomType).mockResolvedValue({ ...bare, TrangThai: 'Ngừng bán' });
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useDeactivateRoomType(11), { wrapper });

    await act(async () => { result.current.mutate(); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = client.getQueryData<OwnerRoomType>(['owner', 'room-types', 11])!;
    expect(cached.TrangThai).toBe('Ngừng bán');
    expect(cached.LOAI_PHONG_TIEN_NGHI).toHaveLength(1);
  });
});
