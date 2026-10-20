import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { meQueryKey, useLogin, useLogout, useRegister, useSignOut } from './hooks';
import * as authApi from './api';
import { useAuthStore } from '../../lib/authStore';
import { makeFakeAccessToken } from '../../test/testUtils';
import type { Account, AuthResult } from '../../types/auth';

vi.mock('./api');

const oldUser = { MaTaiKhoan: 1, HoTen: 'Người dùng cũ' } as Account;
const newUser = { MaTaiKhoan: 2, HoTen: 'Người dùng mới' } as Account;

function setup<T>(useHook: () => T) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  // Dữ liệu của người dùng trước
  queryClient.setQueryData(meQueryKey, oldUser);
  queryClient.setQueryData(['bookings'], [{ MaDatPhong: 1 }]);
  queryClient.setQueryData(['bookings', 1], { MaDatPhong: 1 });
  queryClient.setQueryData(['support', 'mine'], [{ MaYeuCau: 1 }]);
  queryClient.setQueryData(['admin', 'accounts'], { items: [] });
  queryClient.setQueryData(['payment-status', 1], { MaDatPhong: 1 });
  // Dữ liệu công khai phải được giữ lại
  queryClient.setQueryData(['hotels', 'search', { page: 1 }], { items: [] });
  queryClient.setQueryData(['locations'], []);
  queryClient.setQueryData(['amenities'], []);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { queryClient, ...renderHook(useHook, { wrapper }) };
}

const cachedKeys = (queryClient: QueryClient) => queryClient.getQueryCache().getAll().map((query) => query.queryKey);
const PUBLIC_KEYS = [['hotels', 'search', { page: 1 }], ['locations'], ['amenities']];

beforeEach(() => {
  vi.mocked(authApi.logout).mockReset();
  vi.mocked(authApi.login).mockReset();
  useAuthStore.setState({ accessToken: makeFakeAccessToken({ sub: '1', role: 'Khách hàng', exp: 9999999999 }), role: 'Khách hàng' });
});

describe('useLogout', () => {
  it('drops the previous user’s cached data but keeps public data', async () => {
    vi.mocked(authApi.logout).mockResolvedValue(undefined);
    const { queryClient, result } = setup(useLogout);

    await result.current.mutateAsync();

    expect(cachedKeys(queryClient)).toEqual(PUBLIC_KEYS);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('still clears the cache when the logout request itself fails', async () => {
    vi.mocked(authApi.logout).mockRejectedValue(new Error('offline'));
    const { queryClient, result } = setup(useLogout);

    await expect(result.current.mutateAsync()).rejects.toThrow('offline');

    expect(cachedKeys(queryClient)).toEqual(PUBLIC_KEYS);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});

describe('useLogin', () => {
  it('clears the previous user’s cache but keeps the new account in the "me" query', async () => {
    const accessToken = makeFakeAccessToken({ sub: '2', role: 'Khách hàng', exp: 9999999999 });
    vi.mocked(authApi.login).mockResolvedValue({ account: newUser, accessToken } as AuthResult);
    const { queryClient, result } = setup(useLogin);

    result.current.mutate({ identifier: 'moi', MatKhau: 'x' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(meQueryKey)).toEqual(newUser);
    expect(cachedKeys(queryClient)).toEqual([...PUBLIC_KEYS, meQueryKey]);
    expect(useAuthStore.getState().accessToken).toBe(accessToken);
  });
});

describe('useSignOut', () => {
  it('resolves after the server call finished and the local session and user cache are gone', async () => {
    let finish!: () => void;
    vi.mocked(authApi.logout).mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    const { queryClient, result } = setup(useSignOut);

    let done = false;
    const pending = result.current.signOut().then(() => { done = true; });
    await Promise.resolve();
    expect(done).toBe(false);

    finish();
    await pending;

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(cachedKeys(queryClient)).toEqual(PUBLIC_KEYS);
  });

  it('still resolves (never rejects) when the logout request fails, so callers can always navigate away', async () => {
    vi.mocked(authApi.logout).mockRejectedValue(new Error('offline'));
    const { result } = setup(useSignOut);

    await expect(result.current.signOut()).resolves.toBeUndefined();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});

describe('useRegister', () => {
  it('starts from a clean cache: nothing of the previous user survives, the new account is in "me"', async () => {
    const accessToken = makeFakeAccessToken({ sub: '2', role: 'Khách hàng', exp: 9999999999 });
    vi.mocked(authApi.register).mockResolvedValue({ account: newUser, accessToken } as AuthResult);
    const { queryClient, result } = setup(useRegister);

    result.current.mutate({ TenDangNhap: 'moi', Email: 'moi@example.com', MatKhau: 'x', HoTen: 'Mới', SoDienThoai: '0900000000' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(meQueryKey)).toEqual(newUser);
    expect(cachedKeys(queryClient)).toEqual([...PUBLIC_KEYS, meQueryKey]);
    expect(useAuthStore.getState().accessToken).toBe(accessToken);
  });
});
