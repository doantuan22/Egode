import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from './AppErrorBoundary';
import MainLayout from '../layouts/MainLayout';
import { renderWithProviders } from '../../test/testUtils';
import { useAuthStore } from '../../lib/authStore';

let shouldThrow = true;
function Bomb() {
  if (shouldThrow) throw new Error('boom');
  return <p>trang bình thường</p>;
}

beforeEach(() => {
  shouldThrow = true;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  useAuthStore.setState({ accessToken: null, role: null, isBootstrapping: false });
});
afterEach(() => vi.restoreAllMocks());

describe('AppErrorBoundary (inline, per page)', () => {
  it('shows a recoverable error in place of the page without adding a second <main> landmark', () => {
    render(<MemoryRouter><AppErrorBoundary inline><Bomb /></AppErrorBoundary></MemoryRouter>);

    expect(screen.getByRole('alert')).toHaveTextContent('Đã xảy ra lỗi');
    expect(document.querySelector('main')).toBeNull();
  });

  it('"Thử lại" renders the page again', async () => {
    render(<MemoryRouter><AppErrorBoundary inline><Bomb /></AppErrorBoundary></MemoryRouter>);
    shouldThrow = false;

    await userEvent.setup().click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(screen.getByText('trang bình thường')).toBeInTheDocument();
  });

  it('clears the error by itself when the reset key changes (navigating to another page)', () => {
    const { rerender } = render(<MemoryRouter><AppErrorBoundary inline resetKey="/a"><Bomb /></AppErrorBoundary></MemoryRouter>);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    shouldThrow = false;
    rerender(<MemoryRouter><AppErrorBoundary inline resetKey="/b"><Bomb /></AppErrorBoundary></MemoryRouter>);

    expect(screen.getByText('trang bình thường')).toBeInTheDocument();
  });
});

describe('AppErrorBoundary (whole app)', () => {
  it('keeps the full-screen fallback with a reload button', () => {
    render(<AppErrorBoundary><Bomb /></AppErrorBoundary>);

    expect(screen.getByRole('alert')).toHaveTextContent('Đã xảy ra lỗi');
    expect(screen.getByRole('button', { name: 'Tải lại trang' })).toBeInTheDocument();
  });
});

describe('MainLayout', () => {
  it('keeps the navbar when the current page crashes, and recovers after navigating away', async () => {
    renderWithProviders(
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<p>trang chủ</p>} />
          <Route path="/hotels" element={<Bomb />} />
        </Route>
      </Routes>,
      { route: '/hotels' }
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Đã xảy ra lỗi');
    expect(screen.getByRole('link', { name: 'Trang chủ' })).toBeInTheDocument();

    shouldThrow = false;
    await userEvent.setup().click(screen.getByRole('link', { name: 'Trang chủ' }));

    expect(screen.getByText('trang chủ')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
