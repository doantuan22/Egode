import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from './apiClient';
import { queryClient } from '../lib/queryClient';
import { useAuthStore } from '../lib/authStore';
import { makeFakeAccessToken } from '../test/testUtils';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  queryClient.clear();
  queryClient.setQueryData(['bookings'], [{ MaDatPhong: 1 }]);
  queryClient.setQueryData(['auth', 'me'], { MaTaiKhoan: 1 });
  queryClient.setQueryData(['hotels', 'detail', 5], { MaKhachSan: 5 });
  queryClient.setQueryData(['locations'], []);
  useAuthStore.setState({
    accessToken: makeFakeAccessToken({ sub: '1', role: 'Khách hàng', exp: 9999999999 }),
    role: 'Khách hàng',
    sessionExpired: false,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  queryClient.clear();
});

describe('apiClient session expiry', () => {
  it('drops user data, keeps public data and flags the session as expired when a 401 survives the refresh attempt', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ success: false, message: 'Unauthorized' }, 401)));

    await expect(apiClient('/bookings')).rejects.toBeInstanceOf(ApiError);

    expect(queryClient.getQueryCache().getAll().map((query) => query.queryKey)).toEqual([['hotels', 'detail', 5], ['locations']]);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().sessionExpired).toBe(true);
  });

  it('keeps the cache when the refresh succeeds and the retried request works', async () => {
    const fresh = makeFakeAccessToken({ sub: '1', role: 'Khách hàng', exp: 9999999999 });
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/refresh')) return json({ success: true, data: { accessToken: fresh } });
      const authorized = fetchMock.mock.calls.filter(([u]) => !String(u).endsWith('/auth/refresh')).length > 1;
      return authorized ? json({ success: true, data: [] }) : json({ success: false, message: 'expired' }, 401);
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient('/bookings')).resolves.toMatchObject({ success: true });

    expect(queryClient.getQueryData(['bookings'])).toEqual([{ MaDatPhong: 1 }]);
    expect(useAuthStore.getState().sessionExpired).toBe(false);
  });
});

describe('apiClient error contract: { message, code, details }', () => {
  it('validation: the banner text is the field messages, details keep [{ field, message }], code is kept', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({
      success: false,
      message: 'Dữ liệu không hợp lệ',
      code: 'VALIDATION_ERROR',
      details: [
        { field: 'checkIn', message: 'Ngày nhận phòng không được trước hôm nay' },
        { field: 'checkOut', message: 'Mỗi lần đặt tối đa 30 đêm' },
        { field: 'checkOut', message: 'Mỗi lần đặt tối đa 30 đêm' },
      ],
    }, 400)));

    const error = await apiClient('/hotels').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.message).toBe('Ngày nhận phòng không được trước hôm nay. Mỗi lần đặt tối đa 30 đêm');
    expect(apiError.statusCode).toBe(400);
    expect(apiError.code).toBe('VALIDATION_ERROR');
    expect(apiError.details).toHaveLength(3);
    expect(apiError.fieldErrors).toEqual({ checkIn: 'Ngày nhận phòng không được trước hôm nay', checkOut: 'Mỗi lần đặt tối đa 30 đêm' });
  });

  it('a business error keeps the server message and code, and its details if it has any', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ success: false, message: 'Không thể giảm số phòng', code: 'CONFLICT', details: [{ field: 'NgayApDung:2030-01-01', message: 'Đã có 3 phòng được đặt' }] }, 409)));
    await expect(apiClient('/owner/room-types/1/rates')).rejects.toMatchObject({ message: 'Không thể giảm số phòng', statusCode: 409, code: 'CONFLICT' });
  });

  it('keeps the plain message for errors that carry no details', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ success: false, message: 'Không tìm thấy khách sạn', code: 'NOT_FOUND' }, 404)));
    const error = (await apiClient('/hotels/9').catch((e: unknown) => e)) as ApiError;
    expect(error).toMatchObject({ message: 'Không tìm thấy khách sạn', statusCode: 404, code: 'NOT_FOUND' });
    expect(error.fieldErrors).toEqual({});
  });

  it('an unreadable body still ends as a clean ApiError, never a raw object', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>502</html>', { status: 502 })));
    const error = (await apiClient('/hotels').catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(typeof error.message).toBe('string');
    expect(error.message).not.toContain('[object');
  });
});

describe('apiClient refreshes the access token for protected /auth endpoints (change-password), not for credential endpoints', () => {
  const fresh = () => makeFakeAccessToken({ sub: '1', role: 'Khách hàng', exp: 9999999999 });

  it('change-password: 401 with an expired access token → refresh → the SAME request is retried with the new token and succeeds', async () => {
    const newToken = fresh();
    const calls: Array<{ url: string; auth?: string }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), auth: (init?.headers as Record<string, string> | undefined)?.Authorization });
      if (String(url).endsWith('/auth/refresh')) return json({ success: true, data: { accessToken: newToken } });
      const retried = calls.filter((c) => c.url.endsWith('/auth/change-password')).length > 1;
      return retried ? json({ success: true, data: { accessToken: fresh() } }) : json({ success: false, message: 'Invalid or expired access token', code: 'UNAUTHORIZED' }, 401);
    }));

    await expect(apiClient('/auth/change-password', { method: 'POST', body: '{}' })).resolves.toMatchObject({ success: true });

    expect(calls.map((c) => c.url.split('/api').pop())).toEqual(['/auth/change-password', '/auth/refresh', '/auth/change-password']);
    expect(calls[2].auth).toBe(`Bearer ${newToken}`);
    expect(useAuthStore.getState().sessionExpired).toBe(false);
  });

  it('change-password: when the refresh fails too the session ends (no retry loop)', async () => {
    const fetchMock = vi.fn(async (url: string) => (String(url).endsWith('/auth/refresh') ? json({ success: false, message: 'x' }, 401) : json({ success: false, message: 'expired' }, 401)));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient('/auth/change-password', { method: 'POST', body: '{}' })).rejects.toMatchObject({ statusCode: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(2); // the request, then the refresh — nothing more
    expect(useAuthStore.getState().sessionExpired).toBe(true);
  });

  it.each(['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'])('%s: a 401 is final — no refresh is attempted', async (endpoint) => {
    const fetchMock = vi.fn(async () => json({ success: false, message: 'Sai thông tin', code: 'UNAUTHORIZED' }, 401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient(endpoint, { method: 'POST', body: '{}' })).rejects.toMatchObject({ statusCode: 401, message: 'Sai thông tin' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('apiClient when the API host answers with something that is not JSON (#17: wrong VITE_API_BASE_URL / no proxy)', () => {
  it('says so and where to look, instead of the opaque "Failed to parse response JSON"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html><title>SPA</title>', { status: 200, headers: { 'Content-Type': 'text/html' } })));

    const error = await apiClient('/hotels').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toMatch(/không trả về JSON \(HTTP 200\).*VITE_API_BASE_URL/);
  });
});

describe('apiClient always sends the session cookie (cross-site deployments need credentials: "include")', () => {
  it('on normal requests and on the refresh call', async () => {
    const calls: Array<RequestInit | undefined> = [];
    const fresh = makeFakeAccessToken({ sub: '1', role: 'Khách hàng', exp: 9999999999 });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(init);
      if (String(url).endsWith('/auth/refresh')) return json({ success: true, data: { accessToken: fresh } });
      return calls.length === 1 ? json({ success: false, message: 'expired' }, 401) : json({ success: true, data: [] });
    }));

    await apiClient('/bookings');

    expect(calls).toHaveLength(3); // request, refresh, retry
    for (const init of calls) expect(init?.credentials).toBe('include');
    expect(calls[1]?.method).toBe('POST');
  });
});
