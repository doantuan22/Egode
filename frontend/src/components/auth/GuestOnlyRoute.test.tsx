import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { GuestOnlyRoute } from './GuestOnlyRoute';
import { useAuthStore } from '../../lib/authStore';
import { ROLE_NAMES } from '../../lib/roles';

function renderGuest(route = '/login') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={<GuestOnlyRoute />}>
          <Route path="/login" element={<div>form đăng nhập</div>} />
          <Route path="/register" element={<div>form đăng ký</div>} />
        </Route>
        <Route path="/" element={<div>trang chủ</div>} />
        <Route path="/owner" element={<div>khu chủ khách sạn</div>} />
        <Route path="/admin" element={<div>khu quản trị</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const setAuth = (patch: { accessToken: string | null; role: string | null; isBootstrapping: boolean }) => useAuthStore.setState(patch);

beforeEach(() => setAuth({ accessToken: null, role: null, isBootstrapping: false }));

describe('GuestOnlyRoute', () => {
  it('shows the guest page to a visitor without a session', () => {
    renderGuest();
    expect(screen.getByText('form đăng nhập')).toBeInTheDocument();
  });

  it.each([
    [ROLE_NAMES.CUSTOMER, 'trang chủ'],
    [ROLE_NAMES.PARTNER, 'khu chủ khách sạn'],
    [ROLE_NAMES.ADMIN, 'khu quản trị'],
    ['Vai trò lạ', 'trang chủ'],
  ])('sends an already signed-in %s to their home', (role, home) => {
    setAuth({ accessToken: 'token', role, isBootstrapping: false });
    renderGuest('/register');
    expect(screen.getByText(home)).toBeInTheDocument();
    expect(screen.queryByText('form đăng ký')).not.toBeInTheDocument();
  });

  it('does not redirect while the session is still being restored', () => {
    setAuth({ accessToken: 'token', role: ROLE_NAMES.ADMIN, isBootstrapping: true });
    renderGuest();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('khu quản trị')).not.toBeInTheDocument();
    expect(screen.queryByText('form đăng nhập')).not.toBeInTheDocument();
  });

  it('redirects once the restore finishes and finds a session', () => {
    setAuth({ accessToken: null, role: null, isBootstrapping: true });
    renderGuest();
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => setAuth({ accessToken: 'token', role: ROLE_NAMES.PARTNER, isBootstrapping: false }));

    expect(screen.getByText('khu chủ khách sạn')).toBeInTheDocument();
  });

  it('shows the form once the restore finishes without a session', () => {
    setAuth({ accessToken: null, role: null, isBootstrapping: true });
    renderGuest();

    act(() => setAuth({ accessToken: null, role: null, isBootstrapping: false }));

    expect(screen.getByText('form đăng nhập')).toBeInTheDocument();
  });

  it('leaves the page alone when the session appears from the form on screen (the form navigates itself)', () => {
    renderGuest('/register');
    expect(screen.getByText('form đăng ký')).toBeInTheDocument();

    // Trang tự lưu token rồi chuyển hướng
    act(() => setAuth({ accessToken: 'token', role: ROLE_NAMES.CUSTOMER, isBootstrapping: false }));

    expect(screen.getByText('form đăng ký')).toBeInTheDocument();
    expect(screen.queryByText('trang chủ')).not.toBeInTheDocument();
  });
});
